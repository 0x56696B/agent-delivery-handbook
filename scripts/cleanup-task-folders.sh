#!/usr/bin/env bash
#
# cleanup-task-folders.sh — report and reclaim finished task folders under
# ~/work/<PROJECT>/tasks.
#
# Mechanical layer only: this script never asks Azure DevOps whether a PR
# or ticket is done. It reports git/worktree/remote facts as TSV, and
# performs the archive/delete steps a caller (or the task-cleanup
# skill) has already decided are safe. Every mutating subcommand is a
# dry run unless --apply is passed.
#
# Subcommands:
#   report [--no-remote]
#   clean <task_folder>... [--apply] [--force] [--min-age-days N]
#   clean-worktree <repo>:<branch>... [--apply] [--force]
#   strays <name>... [--apply]
#   prune [--apply]
#
# Exit codes: 0 success, 1 refusal or error, 2 usage.
#
# Example (run from ~/work/<PROJECT>/tasks, where the *-bare repos live one
# level up in ~/work/<PROJECT>):
#   ./cleanup-task-folders.sh report
#   ./cleanup-task-folders.sh clean BUG-12345-multiple-healthchecks-failing --apply
#   ./cleanup-task-folders.sh strays image.png temp --apply
#   ./cleanup-task-folders.sh prune --apply

set -uo pipefail
shopt -s nullglob

usage() {
  cat <<'EOF'
Usage:
  cleanup-task-folders.sh report [--no-remote]
  cleanup-task-folders.sh clean <task_folder>... [--apply] [--force] [--min-age-days N]
  cleanup-task-folders.sh clean-worktree <repo>:<branch>... [--apply] [--force]
  cleanup-task-folders.sh strays <name>... [--apply]
  cleanup-task-folders.sh prune [--apply]

  report          Read-only. Prints one TSV record per task folder, repo
                  link, root stray, and orphan worktree, plus a summary
                  line. --no-remote skips the ls-remote pass (remote_state
                  reports as "unknown").
  clean           Archives *.md/*.txt files, removes each repo's worktree
                  and local branch, then deletes the folder. Refuses a
                  folder that is not a task folder, is the caller's own
                  working directory, is younger than --min-age-days
                  (default 7), or has a dirty/ahead/diverged repo, unless
                  --force is passed.
  clean-worktree  Same safety gates as clean, for one orphaned worktree
                  with no task folder left. No archive, no folder delete.
  strays          Deletes a named direct child of the tasks root that is
                  not a task folder and not on the keep-list.
  prune           Runs "git worktree prune" in every bare repo, clearing
                  stale registrations only.
EOF
}

log()  { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
err()  { printf 'ERROR: %s\n' "$*" >&2; }

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
tasks_root="$script_dir"
work_root="$(cd "$script_dir/.." && pwd -P)"

# Exact names, never reported as strays, never deleted. Every entry whose
# name starts with "." is exempt too (checked separately in is_kept).
KEEP_LIST=(setup-task-branch.sh setup-task-lsp.sh cleanup-task-folders.sh
  remove-marker.sh WATCHDOG.yml lsp-tooling archive plans notes)

declare -A REMOTE_SHA=()
declare -A DEFAULT_SHA=()
NO_REMOTE=false
CACHE_BUILT=false

is_kept() {
  local name="$1" k
  [[ "$name" == .* ]] && return 0
  for k in "${KEEP_LIST[@]}"; do
    [[ "$name" == "$k" ]] && return 0
  done
  return 1
}

# bare_repos — echoes every "<work_root>/<name>-bare" that is a real bare repo.
bare_repos() {
  local d
  for d in "$work_root"/*-bare; do
    [[ -d "$d" ]] || continue
    [[ "$(git --git-dir="$d" rev-parse --is-bare-repository 2>/dev/null || true)" == "true" ]] || continue
    printf '%s\n' "$d"
  done
}

# is_task_folder <dir> — true when <dir> is a direct child of $tasks_root,
# is a directory, and holds at least one symlink whose readlink target
# matches ^\.\./\.\./[^/]+-bare/.+$
is_task_folder() {
  local dir="$1" entry target
  [[ -d "$dir" ]] || return 1
  [[ "$(dirname "$dir")" == "$tasks_root" ]] || return 1
  for entry in "$dir"/*; do
    [[ -L "$entry" ]] || continue
    target="$(readlink "$entry")"
    [[ "$target" =~ ^\.\./\.\./[^/]+-bare/.+$ ]] && return 0
  done
  return 1
}

# repo_links <dir> — echoes one <repo>\t<branch>\t<bare_dir>\t<worktree_path>
# line per repo symlink. repo is the link's basename; branch is the target
# with the leading ../../<repo>-bare/ stripped.
repo_links() {
  local dir="$1" entry target repo branch bare_dir wt
  for entry in "$dir"/*; do
    [[ -L "$entry" ]] || continue
    target="$(readlink "$entry")"
    [[ "$target" =~ ^\.\./\.\./([^/]+)-bare/(.+)$ ]] || continue
    repo="$(basename "$entry")"
    branch="${BASH_REMATCH[2]}"
    bare_dir="$work_root/${BASH_REMATCH[1]}-bare"
    wt="$bare_dir/$branch"
    printf '%s\t%s\t%s\t%s\n' "$repo" "$branch" "$bare_dir" "$wt"
  done
}

# parse_worktrees <bare> — echoes <path>\t<branch> per registered worktree.
# branch is empty for a detached HEAD, "__bare__" for the bare root entry.
parse_worktrees() {
  local bare="$1" path="" branch="" line
  while IFS= read -r line; do
    case "$line" in
      worktree\ *)
        [[ -n "$path" ]] && printf '%s\t%s\n' "$path" "$branch"
        path="${line#worktree }"
        branch=""
        ;;
      branch\ refs/heads/*)
        branch="${line#branch refs/heads/}"
        ;;
      bare)
        branch="__bare__"
        ;;
    esac
  done < <(git --git-dir="$bare" worktree list --porcelain 2>/dev/null)
  [[ -n "$path" ]] && printf '%s\t%s\n' "$path" "$branch"
}

entry_age_days() {
  local path="$1" now newest m child
  now="$(date +%s)"
  newest="$(stat -f %m "$path" 2>/dev/null || printf '%s' "$now")"
  if [[ -d "$path" && ! -L "$path" ]]; then
    for child in "$path"/*; do
      [[ -e "$child" || -L "$child" ]] || continue
      m="$(stat -f %m "$child" 2>/dev/null)" || continue
      (( m > newest )) && newest="$m"
    done
  fi
  printf '%d\n' $(( (now - newest) / 86400 ))
}

entry_size_kb() {
  du -sk "$1" 2>/dev/null | cut -f1
}

worktree_state() {
  local wt="$1" n
  if [[ ! -d "$wt" ]]; then
    printf 'missing\n'
    return
  fi
  n="$(git -C "$wt" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$n" -eq 0 ]]; then
    printf 'clean\n'
  else
    printf 'dirty:%s\n' "$n"
  fi
}

# remote_sha_for <bare> <branch> — prints the remote head sha, preferring
# the report's prebuilt cache; falls back to a direct ls-remote only when
# that cache was never built (clean/clean-worktree run standalone). Once
# the bulk cache exists, a missing key means the remote head is gone —
# no per-branch SSH round-trip for every merged/deleted branch.
remote_sha_for() {
  local bare="$1" branch="$2" repo key line sha
  repo="$(basename "$bare")"; repo="${repo%-bare}"
  key="$repo/$branch"
  if [[ -n "${REMOTE_SHA[$key]+x}" ]]; then
    printf '%s\n' "${REMOTE_SHA[$key]}"
    return 0
  fi
  $CACHE_BUILT && return 1
  line="$(git --git-dir="$bare" ls-remote --heads origin "refs/heads/$branch" 2>/dev/null)"
  [[ -n "$line" ]] || return 1
  sha="${line%%$'\t'*}"
  printf '%s\n' "$sha"
}

# remote_state <repo> <branch> <head_sha> <bare>
remote_state() {
  local branch="$2" head_sha="$3" bare="$4" remote_sha n
  if $NO_REMOTE; then
    printf 'unknown\n'
    return
  fi
  remote_sha="$(remote_sha_for "$bare" "$branch")" || { printf 'gone\n'; return; }
  [[ -n "$remote_sha" ]] || { printf 'gone\n'; return; }
  if [[ -z "$head_sha" ]]; then
    printf 'unknown\n'
    return
  fi
  if [[ "$remote_sha" == "$head_sha" ]]; then
    printf 'in-sync\n'
    return
  fi
  if git --git-dir="$bare" merge-base --is-ancestor "$remote_sha" "$head_sha" 2>/dev/null; then
    n="$(git --git-dir="$bare" rev-list --count "$remote_sha..$head_sha" 2>/dev/null)"
    printf 'ahead:%s\n' "${n:-0}"
    return
  fi
  printf 'diverged\n'
}

# default_sha_for <bare> <repo> — cached default-branch sha for a bare repo.
default_sha_for() {
  local bare="$1" repo="$2" default_ref sha
  if [[ -n "${DEFAULT_SHA[$repo]+x}" ]]; then
    printf '%s\n' "${DEFAULT_SHA[$repo]}"
    return
  fi
  default_ref="$(git --git-dir="$bare" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  sha=""
  if [[ -n "$default_ref" ]]; then
    sha="$(git --git-dir="$bare" rev-parse --verify "refs/remotes/origin/$default_ref" 2>/dev/null || true)"
    [[ -z "$sha" ]] && sha="$(git --git-dir="$bare" rev-parse --verify "refs/heads/$default_ref" 2>/dev/null || true)"
  fi
  DEFAULT_SHA[$repo]="$sha"
  printf '%s\n' "$sha"
}

unique_commits() {
  local bare="$1" default_sha="$2" branch="$3" n
  [[ -n "$default_sha" ]] || { printf '0\n'; return; }
  n="$(git --git-dir="$bare" rev-list --count "$default_sha..refs/heads/$branch" 2>/dev/null)"
  printf '%s\n' "${n:-0}"
}

last_commit_date() {
  local bare="$1" branch="$2" d
  d="$(git --git-dir="$bare" log -1 --format=%cs "refs/heads/$branch" 2>/dev/null)"
  printf '%s\n' "${d:-unknown}"
}

head_sha_for() {
  local bare="$1" branch="$2"
  git --git-dir="$bare" rev-parse --verify "refs/heads/$branch" 2>/dev/null || true
}

# ---------------------------------------------------------------- report --

cmd_report() {
  NO_REMOTE=false
  local arg
  for arg in "$@"; do
    case "$arg" in
      --no-remote) NO_REMOTE=true ;;
      *) err "report: unknown argument '$arg'"; usage; exit 2 ;;
    esac
  done

  REMOTE_SHA=()
  DEFAULT_SHA=()
  CACHE_BUILT=false

  local bare repo sha ref
  if ! $NO_REMOTE; then
    while IFS= read -r bare; do
      repo="$(basename "$bare")"; repo="${repo%-bare}"
      while IFS=' ' read -r sha ref; do
        [[ -n "$sha" && -n "$ref" ]] || continue
        REMOTE_SHA["$repo/${ref#refs/heads/}"]="$sha"
      done < <(git --git-dir="$bare" ls-remote --heads origin 2>/dev/null | awk '$2 ~ /^refs\/heads\//{print $1" "$2}')
    done < <(bare_repos)
    CACHE_BUILT=true
  fi

  local -a folders=()
  local folder
  for folder in "$tasks_root"/*/; do
    folder="${folder%/}"
    is_task_folder "$folder" || continue
    folders+=("$folder")
  done

  declare -A LINKED_WT=()
  local total_repos=0 total_strays=0 total_orphans=0

  for folder in "${folders[@]}"; do
    local name age size count repo_lines
    name="$(basename "$folder")"
    age="$(entry_age_days "$folder")"
    size="$(entry_size_kb "$folder")"
    repo_lines="$(repo_links "$folder")"
    count=0
    [[ -n "$repo_lines" ]] && count="$(wc -l <<<"$repo_lines" | tr -d ' ')"
    printf 'FOLDER\t%s\t%s\t%s\t%s\n' "$name" "$age" "$size" "$count"

    [[ -n "$repo_lines" ]] || continue
    local repo branch bare wt ws rs uc lcd default_sha head_sha
    while IFS=$'\t' read -r repo branch bare wt; do
      [[ -n "$repo" ]] || continue
      LINKED_WT["$wt"]=1
      ws="$(worktree_state "$wt")"
      head_sha="$(head_sha_for "$bare" "$branch")"
      default_sha="$(default_sha_for "$bare" "$repo")"
      rs="$(remote_state "$repo" "$branch" "$head_sha" "$bare")"
      uc="$(unique_commits "$bare" "$default_sha" "$branch")"
      lcd="$(last_commit_date "$bare" "$branch")"
      printf 'REPO\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$repo" "$branch" "$ws" "$rs" "$uc" "$lcd"
      total_repos=$((total_repos + 1))
    done <<<"$repo_lines"
  done

  local entry ename kind is_folder f
  for entry in "$tasks_root"/*; do
    ename="$(basename "$entry")"
    is_kept "$ename" && continue
    is_folder=false
    for f in "${folders[@]}"; do
      [[ "$f" == "$entry" ]] && is_folder=true && break
    done
    $is_folder && continue
    [[ -d "$entry" ]] && kind=dir || kind=file
    printf 'STRAY\t%s\t%s\t%s\t%s\n' "$ename" "$(entry_age_days "$entry")" "$(entry_size_kb "$entry")" "$kind"
    total_strays=$((total_strays + 1))
  done

  local bare_real wtpath wbranch
  while IFS= read -r bare; do
    repo="$(basename "$bare")"; repo="${repo%-bare}"
    while IFS=$'\t' read -r wtpath wbranch; do
      [[ -n "$wtpath" ]] || continue
      [[ "$wbranch" == "__bare__" ]] && continue
      [[ -z "$wbranch" ]] && continue
      case "$wbranch" in
        main|master|fix-asd) continue ;;
      esac
      [[ -n "${LINKED_WT[$wtpath]+x}" ]] && continue
      ws="$(worktree_state "$wtpath")"
      head_sha="$(head_sha_for "$bare" "$wbranch")"
      default_sha="$(default_sha_for "$bare" "$repo")"
      rs="$(remote_state "$repo" "$wbranch" "$head_sha" "$bare")"
      uc="$(unique_commits "$bare" "$default_sha" "$wbranch")"
      printf 'ORPHAN\t%s\t%s\t%s\t%s\t%s\n' "$repo" "$wbranch" "$ws" "$rs" "$uc"
      total_orphans=$((total_orphans + 1))
    done < <(parse_worktrees "$bare")
  done < <(bare_repos)

  printf 'SUMMARY\t%s\t%s\t%s\t%s\n' "${#folders[@]}" "$total_repos" "$total_strays" "$total_orphans"
}

# ------------------------------------------------------------------ clean --

# docker_cleanup_for_path <worktree> <apply> — removes the Docker resources of
# every compose project whose working dir resolves to <worktree>: containers,
# labelled volumes and networks, and locally built images named
# "<project>-*". Shared registry images (mongo, nginx, ...) are never touched.
# Skips silently when docker is missing or the daemon is down.
docker_cleanup_for_path() {
  local wt="$1" apply="$2" prefix="" wt_real d d_real proj id
  $apply || prefix="DRY-RUN: "
  command -v docker >/dev/null 2>&1 || return 0
  docker info >/dev/null 2>&1 || return 0
  wt_real="$(cd "$wt" 2>/dev/null && pwd -P)" || wt_real="$wt"

  local -A projects=()
  while IFS=$'\t' read -r proj d; do
    [[ -n "$proj" && -n "$d" ]] || continue
    d_real="$(cd "$d" 2>/dev/null && pwd -P)" || d_real="$d"
    [[ "$d_real" == "$wt_real" ]] && projects["$proj"]=1
  done < <(docker ps -a --format '{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.project.working_dir"}}' | sort -u)

  for proj in "${!projects[@]}"; do
    while IFS= read -r id; do
      [[ -n "$id" ]] || continue
      $apply && docker rm -f -v "$id" >/dev/null 2>&1
      log "${prefix}docker rm container $id (project $proj)"
    done < <(docker ps -aq --filter "label=com.docker.compose.project=$proj")
    while IFS= read -r id; do
      [[ -n "$id" ]] || continue
      $apply && docker volume rm "$id" >/dev/null 2>&1
      log "${prefix}docker volume rm $id (project $proj)"
    done < <(docker volume ls -q --filter "label=com.docker.compose.project=$proj")
    while IFS= read -r id; do
      [[ -n "$id" ]] || continue
      $apply && docker network rm "$id" >/dev/null 2>&1
      log "${prefix}docker network rm $id (project $proj)"
    done < <(docker network ls -q --filter "label=com.docker.compose.project=$proj")
    while IFS= read -r id; do
      [[ -n "$id" ]] || continue
      $apply && docker rmi "$id" >/dev/null 2>&1
      log "${prefix}docker rmi $id (project $proj)"
    done < <(docker image ls --format '{{.Repository}}:{{.Tag}}' --filter "reference=$proj-*")
  done
}

remove_worktree_and_branch() {
  local repo="$1" branch="$2" bare="$3" wt="$4" apply="$5" force="$6"
  local prefix="" out
  $apply || prefix="DRY-RUN: "

  [[ -d "$wt" ]] && docker_cleanup_for_path "$wt" "$apply"
  if [[ -d "$wt" ]]; then
    if $apply; then
      if $force; then
        out="$(git --git-dir="$bare" worktree remove --force "$wt" 2>&1)"
      else
        out="$(git --git-dir="$bare" worktree remove "$wt" 2>&1)"
      fi
      [[ -n "$out" ]] && warn "$out"
    fi
    log "${prefix}worktree remove $wt"
  else
    if $apply; then
      git --git-dir="$bare" worktree prune >/dev/null 2>&1 || true
    fi
    log "${prefix}worktree prune (missing $wt)"
  fi

  if $apply; then
    out="$(git --git-dir="$bare" branch -D "$branch" 2>&1)" || true
  fi
  log "${prefix}branch -D $branch ($repo)"

  local dirpart="$branch"
  while [[ "$dirpart" == */* ]]; do
    dirpart="${dirpart%/*}"
    if $apply; then
      rmdir "$bare/$dirpart" 2>/dev/null || true
    fi
  done
}

clean_one_folder() {
  local farg="$1" apply="$2" force="$3" min_age_days="$4" run_dir="$5"
  local folder
  case "$farg" in
    /*) folder="$farg" ;;
    *) folder="$tasks_root/$farg" ;;
  esac
  folder="${folder%/}"

  if ! is_task_folder "$folder"; then
    err "clean: '$farg' is not a task folder"
    return 1
  fi

  local folder_real
  folder_real="$(cd "$folder" && pwd -P)"
  if [[ "$run_dir" == "$folder_real" || "$run_dir" == "$folder_real"/* ]]; then
    err "clean: refusing to clean '$farg' — it is the directory this session started in"
    return 1
  fi

  local age
  age="$(entry_age_days "$folder")"
  if [[ "$age" -lt "$min_age_days" ]] && ! $force; then
    err "clean: '$farg' is only $age day(s) old (minimum $min_age_days); use --force or --min-age-days to override"
    return 1
  fi

  local repo_lines
  repo_lines="$(repo_links "$folder")"

  if [[ -n "$repo_lines" ]] && ! $force; then
    local repo branch bare wt ws rs head_sha
    while IFS=$'\t' read -r repo branch bare wt; do
      [[ -n "$repo" ]] || continue
      ws="$(worktree_state "$wt")"
      if [[ "$ws" == dirty:* ]]; then
        err "clean: '$farg' repo '$repo' worktree is $ws; use --force to override"
        return 1
      fi
      head_sha="$(head_sha_for "$bare" "$branch")"
      rs="$(remote_state "$repo" "$branch" "$head_sha" "$bare")"
      if [[ "$rs" == ahead:* || "$rs" == diverged ]]; then
        err "clean: '$farg' repo '$repo' remote_state is $rs; use --force to override"
        return 1
      fi
    done <<<"$repo_lines"
  fi

  local size
  size="$(entry_size_kb "$folder")"
  local prefix=""
  $apply || prefix="DRY-RUN: "

  local archive_dir="$tasks_root/archive/$(basename "$folder")"
  $apply && mkdir -p "$archive_dir"

  local f rel dest
  while IFS= read -r -d '' f; do
    rel="${f#"$folder"/}"
    dest="$archive_dir/$rel"
    if $apply; then
      mkdir -p "$(dirname "$dest")"
      cp -p "$f" "$dest"
    fi
    log "${prefix}archive $rel"
  done < <(find "$folder" -type f \( -name '*.md' -o -name '*.txt' \) -print0)

  if $apply; then
    {
      printf 'cleaned\t%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%d)" "$(basename "$folder")" "$age" "$size"
      if [[ -n "$repo_lines" ]]; then
        local repo branch bare wt lcd rs2 uc default_sha head_sha
        while IFS=$'\t' read -r repo branch bare wt; do
          [[ -n "$repo" ]] || continue
          head_sha="$(head_sha_for "$bare" "$branch")"
          default_sha="$(default_sha_for "$bare" "$repo")"
          rs2="$(remote_state "$repo" "$branch" "$head_sha" "$bare")"
          uc="$(unique_commits "$bare" "$default_sha" "$branch")"
          lcd="$(last_commit_date "$bare" "$branch")"
          printf '%s\t%s\t%s\t%s\t%s\n' "$repo" "$branch" "$lcd" "$rs2" "$uc"
        done <<<"$repo_lines"
      fi
    } > "$archive_dir/cleanup.tsv"
  else
    log "${prefix}write $archive_dir/cleanup.tsv"
  fi

  local wt_count=0
  [[ -n "$repo_lines" ]] && wt_count="$(wc -l <<<"$repo_lines" | tr -d ' ')"

  if [[ -n "$repo_lines" ]]; then
    local repo branch bare wt
    while IFS=$'\t' read -r repo branch bare wt; do
      [[ -n "$repo" ]] || continue
      remove_worktree_and_branch "$repo" "$branch" "$bare" "$wt" "$apply" "$force"
    done <<<"$repo_lines"
  fi

  if $apply; then
    rm -rf "$folder"
    log "CLEANED $farg freed ~${size} KB, ${wt_count} worktrees removed"
  else
    log "${prefix}rm -rf $folder"
    log "DRY-RUN: would clean $farg, freeing ~${size} KB, removing ${wt_count} worktree(s)"
  fi

  return 0
}

cmd_clean() {
  local apply=false force=false min_age_days=7
  local -a folders_arg=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --apply) apply=true; shift ;;
      --force) force=true; shift ;;
      --min-age-days) min_age_days="$2"; shift 2 ;;
      --min-age-days=*) min_age_days="${1#*=}"; shift ;;
      -*) err "clean: unknown option '$1'"; usage; exit 2 ;;
      *) folders_arg+=("$1"); shift ;;
    esac
  done
  if [[ ${#folders_arg[@]} -eq 0 ]]; then
    err "clean: at least one task_folder required"
    usage
    exit 2
  fi

  local run_dir
  run_dir="$(pwd -P)"
  local overall_rc=0 farg
  for farg in "${folders_arg[@]}"; do
    clean_one_folder "$farg" "$apply" "$force" "$min_age_days" "$run_dir" || overall_rc=1
  done
  exit $overall_rc
}

cmd_clean_worktree() {
  local apply=false force=false
  local -a specs=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --apply) apply=true; shift ;;
      --force) force=true; shift ;;
      -*) err "clean-worktree: unknown option '$1'"; usage; exit 2 ;;
      *) specs+=("$1"); shift ;;
    esac
  done
  if [[ ${#specs[@]} -eq 0 ]]; then
    err "clean-worktree: at least one repo:branch required"
    usage
    exit 2
  fi

  local overall_rc=0 spec repo branch bare wt
  for spec in "${specs[@]}"; do
    if [[ "$spec" != *:* ]]; then
      err "clean-worktree: '$spec' must be <repo>:<branch>"
      overall_rc=1
      continue
    fi
    repo="${spec%%:*}"
    branch="${spec#*:}"
    bare="$work_root/${repo}-bare"
    if [[ ! -d "$bare" ]]; then
      err "clean-worktree: unknown repo '$repo' (no $bare)"
      overall_rc=1
      continue
    fi
    wt="$bare/$branch"

    if ! $force; then
      local ws rs head_sha
      ws="$(worktree_state "$wt")"
      if [[ "$ws" == dirty:* ]]; then
        err "clean-worktree: '$spec' worktree is $ws; use --force to override"
        overall_rc=1
        continue
      fi
      head_sha="$(head_sha_for "$bare" "$branch")"
      rs="$(remote_state "$repo" "$branch" "$head_sha" "$bare")"
      if [[ "$rs" == ahead:* || "$rs" == diverged ]]; then
        err "clean-worktree: '$spec' remote_state is $rs; use --force to override"
        overall_rc=1
        continue
      fi
    fi

    remove_worktree_and_branch "$repo" "$branch" "$bare" "$wt" "$apply" "$force"
  done
  exit $overall_rc
}

cmd_strays() {
  local apply=false
  local -a names=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --apply) apply=true; shift ;;
      -*) err "strays: unknown option '$1'"; usage; exit 2 ;;
      *) names+=("$1"); shift ;;
    esac
  done
  if [[ ${#names[@]} -eq 0 ]]; then
    err "strays: at least one name required"
    usage
    exit 2
  fi

  local overall_rc=0 name path
  for name in "${names[@]}"; do
    if [[ "$name" == */* ]]; then
      err "strays: '$name' must be a direct child name, not a path"
      overall_rc=1
      continue
    fi
    if is_kept "$name"; then
      err "strays: '$name' is on the keep-list; refusing"
      overall_rc=1
      continue
    fi
    path="$tasks_root/$name"
    if [[ ! -e "$path" && ! -L "$path" ]]; then
      err "strays: '$name' does not exist under $tasks_root"
      overall_rc=1
      continue
    fi
    if is_task_folder "$path"; then
      err "strays: '$name' is a task folder; use 'clean' instead"
      overall_rc=1
      continue
    fi
    if $apply; then
      rm -rf "$path"
      log "REMOVED $name"
    else
      log "DRY-RUN: rm -rf $path"
    fi
  done
  exit $overall_rc
}

cmd_prune() {
  local apply=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --apply) apply=true; shift ;;
      *) err "prune: unknown argument '$1'"; usage; exit 2 ;;
    esac
  done

  local bare
  while IFS= read -r bare; do
    log "== $(basename "$bare") =="
    if $apply; then
      git --git-dir="$bare" worktree prune -v
    else
      git --git-dir="$bare" worktree prune --dry-run
    fi
  done < <(bare_repos)
}

# -------------------------------------------------------------------- main --

if [[ $# -lt 1 ]]; then
  usage
  exit 2
fi

subcommand="$1"
shift

case "$subcommand" in
  report) cmd_report "$@" ;;
  clean) cmd_clean "$@" ;;
  clean-worktree) cmd_clean_worktree "$@" ;;
  strays) cmd_strays "$@" ;;
  prune) cmd_prune "$@" ;;
  -h|--help) usage; exit 0 ;;
  *) err "unknown subcommand '$subcommand'"; usage; exit 2 ;;
esac
