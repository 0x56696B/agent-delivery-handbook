#!/usr/bin/env bash
#
# setup-task-branch.sh — create a task branch across every bare repo and
# collect the resulting worktrees under one task folder.
#
# Default mode: for every "<name>-bare" directory found in the PARENT of
# the directory this script is run from:
#   1. Create <branch_name> as a git worktree (branched off the repo's
#      default branch), unless the branch/worktree already exists.
#   2. Symlink the bare repo's root .env into the new worktree.
# Then, under target_dir (relative paths resolve against the directory
# this script is run from), create one relative symlink per repo pointing
# at its new branch worktree. The script creates target_dir itself; never
# create it yourself before running the script. Before creating it, the
# script checks the parent directory for an existing folder in the same
# "<TYPE>-<ID>-*" family (e.g. "BUG-12345-*") under a different summary
# slug, and refuses to create a duplicate — reuse the existing folder name
# it reports instead.
#
# PR mode (--pr <repo_name>): operates on the single "<repo_name>-bare"
# repo only. <branch_name> must already exist on origin (a PR's source
# branch); it is fetched and checked out as a worktree instead of being
# created from the default branch. The target branch (default "main",
# override with --target-branch) is fetched too, for a fresh merge base.
# No .env symlink is made, since a PR review is read-only.
#
# Usage:
#   ./setup-task-branch.sh <branch_name> <target_dir>
#   ./setup-task-branch.sh --pr <repo_name> [--target-branch <branch>] <branch_name> <target_dir>
#
# Example (run from ~/work/<PROJECT>/tasks, where the *-bare repos live one
# level up in ~/work/<PROJECT>):
#   ./setup-task-branch.sh fix/BUG-12345-healthchecks BUG-12345-multiple-healthchecks-failing
#   ./setup-task-branch.sh --pr web-app fix/settings-env-fail-closed PR-REVIEW-4567-settings-env-fail-closed
#
# 

set -uo pipefail

usage() {
  cat <<'EOF'
Usage:
  setup-task-branch.sh <branch_name> <target_dir>
  setup-task-branch.sh --pr <repo_name> [--target-branch <branch>] <branch_name> <target_dir>

  branch_name     Default mode: name of the branch to create (or reuse) in
                  every *-bare repo found in the parent of the current
                  directory. PR mode: name of a branch that already exists
                  on origin in the one repo named by --pr.
  target_dir      Directory to collect the branch worktree symlinks in.
                  If not an absolute path, it is resolved relative to the
                  current directory.
  --pr repo_name  Switch to PR mode: wire only "<repo_name>-bare", check
                  out branch_name from origin instead of creating it from
                  the default branch, and skip the .env symlink.
  --target-branch branch
                  PR mode only. Also fetch this branch from origin, for a
                  fresh merge base. Defaults to "main".
EOF
}
# 

log()  { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
err()  { printf 'ERROR: %s\n' "$*" >&2; }

# relpath TARGET BASE — relative path from BASE to TARGET.
# Both arguments must be absolute, symlink-resolved paths (no trailing slash).
relpath() {
  local target="$1" base="$2"
  local IFS=/
  local -a t_parts b_parts
  read -ra t_parts <<<"$target"
  read -ra b_parts <<<"$base"
  local i=0
  while [[ $i -lt ${#t_parts[@]} && $i -lt ${#b_parts[@]} && "${t_parts[$i]}" == "${b_parts[$i]}" ]]; do
    i=$((i + 1))
  done
  local rel=""
  local j
  for ((j = i; j < ${#b_parts[@]}; j++)); do
    rel="../${rel}"
  done
  for ((j = i; j < ${#t_parts[@]}; j++)); do
    rel="${rel}${t_parts[$j]}/"
  done
  rel="${rel%/}"
  printf '%s\n' "$rel"
}

pr_repo=""
pr_target_branch="main"

# Standing exclusion: repos retired from active task scope. Skipped entirely
# in default (all-repos) mode before any git work runs, so a task folder
# never gets a symlink/worktree for them in the first place. Not applied in
# --pr mode, since that mode targets one named repo explicitly.
excluded_repos=(legacy-agent)

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --pr)
      [[ $# -ge 2 ]] || { err "--pr requires a repo name"; usage; exit 1; }
      pr_repo="$2"
      shift 2
      ;;
    --target-branch)
      [[ $# -ge 2 ]] || { err "--target-branch requires a branch name"; usage; exit 1; }
      pr_target_branch="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    -*)
      err "Unknown option: $1"
      usage
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

if [[ $# -ne 2 ]]; then
  usage
  exit 1
fi

pr_mode=false
[[ -n "$pr_repo" ]] && pr_mode=true

branch_name="$1"
target_dir_arg="$2"

run_dir="$(pwd -P)"
parent_dir="$(cd "$run_dir/.." && pwd -P)" || {
  err "Cannot resolve parent directory of $run_dir"
  exit 1
}

case "$target_dir_arg" in
  /*) target_dir="$target_dir_arg" ;;
  *) target_dir="$run_dir/$target_dir_arg" ;;
esac

# Duplicate-folder guard: a task folder is named "<TYPE>-<ID>-<summary>"
# (e.g. "BUG-12345-multiple-healthchecks-failing"). Refuse to create a
# second folder for the same "<TYPE>-<ID>-" family under the same parent
# directory with a different summary slug — that would split one ticket
# across two folders. Reusing the exact same target_dir name is unaffected
# (idempotent rerun). The pattern anchors on the FIRST run of digits after
# the letters/dashes prefix, so a numeric token inside the summary itself
# (e.g. "...-12345-regression") never steals the match. Ticketless tasks
# share the placeholder ID "00000" by convention, so that family is exempt
# — each such folder's summary, not the ID, is its real identity.
# 
target_parent_dir="$(dirname "$target_dir")"
target_base="$(basename "$target_dir")"
if [[ "$target_base" =~ ^([A-Za-z-]+)-([0-9]+)-.+$ ]] && [[ "${BASH_REMATCH[2]}" != "00000" ]]; then
  family_prefix="${BASH_REMATCH[1]}-${BASH_REMATCH[2]}-"
  if [[ -d "$target_parent_dir" ]]; then
    shopt -s nullglob
    existing_family=("$target_parent_dir/${family_prefix}"*)
    shopt -u nullglob
    for existing_dir in "${existing_family[@]}"; do
      [[ -d "$existing_dir" ]] || continue
      if [[ "$(basename "$existing_dir")" != "$target_base" ]]; then
        err "A task folder for '${family_prefix%-}' already exists: $existing_dir"
        err "Reuse that folder instead of creating '$target_base' with a different summary slug."
        exit 1
      fi
    done
  fi
fi

mkdir -p "$target_dir" || {
  err "Cannot create target_dir: $target_dir"
  exit 1
}
target_dir="$(cd "$target_dir" && pwd -P)"

if $pr_mode; then
  pr_bare_dir="$parent_dir/${pr_repo}-bare"
  if [[ ! -d "$pr_bare_dir" ]]; then
    err "PR mode: $pr_bare_dir not found"
    exit 1
  fi
  bare_repos=("$pr_bare_dir")
else
  shopt -s nullglob
  bare_repos=("$parent_dir"/*-bare)
  shopt -u nullglob

  if [[ ${#bare_repos[@]} -eq 0 ]]; then
    err "No *-bare repos found in $parent_dir"
    exit 1
  fi
fi
# 

log "Branch:      $branch_name"
if $pr_mode; then
  log "Mode:        PR (existing remote branch, single repo)"
  log "Repo:        $pr_repo"
  log "Target ref:  $pr_target_branch"
else
  log "Mode:        new branch (all *-bare repos)"
fi
log "Bare repos:  $parent_dir"
log "Target dir:  $target_dir"
log ""
# 

successes=()
failures=()

for bare_dir in "${bare_repos[@]}"; do
  [[ -d "$bare_dir" ]] || continue
  repo_bare_name="$(basename "$bare_dir")"
  repo_name="${repo_bare_name%-bare}"

  if ! $pr_mode; then
    is_excluded=false
    for excluded_name in "${excluded_repos[@]}"; do
      [[ "$repo_name" == "$excluded_name" ]] && is_excluded=true && break
    done
    if $is_excluded; then
      log "== $repo_bare_name =="
      log "  Standing exclusion; skipping (no worktree, no symlink)"
      log ""
      continue
    fi
  fi

  is_bare="$(git --git-dir="$bare_dir" rev-parse --is-bare-repository 2>/dev/null || true)"
  if [[ "$is_bare" != "true" ]]; then
    warn "Skipping $repo_bare_name: not a git bare repository"
    continue
  fi

  log "== $repo_bare_name =="

  if $pr_mode; then
    target_fetch_ref="refs/remotes/origin/$pr_target_branch"
    if ! git --git-dir="$bare_dir" fetch --quiet origin \
         "+refs/heads/$branch_name:refs/remotes/origin/$branch_name" \
         "+refs/heads/$pr_target_branch:$target_fetch_ref" >/dev/null 2>&1; then
      err "  Cannot fetch '$branch_name' and '$pr_target_branch' from origin; PR mode requires both to exist remotely"
      failures+=("$repo_bare_name")
      continue
    fi
    base_rev="refs/remotes/origin/$branch_name"
    log "  Fetched '$branch_name' and '$pr_target_branch' from origin"
  else
    base_ref="$(git --git-dir="$bare_dir" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
    if [[ -z "$base_ref" ]]; then
      err "  Cannot determine default branch (HEAD); skipping"
      failures+=("$repo_bare_name")
      continue
    fi

    fetch_ref="refs/remotes/origin/$base_ref"
    if git --git-dir="$bare_dir" fetch --quiet origin "+refs/heads/$base_ref:$fetch_ref" >/dev/null 2>&1; then
      base_rev="$fetch_ref"
    else
      warn "  Could not fetch latest '$base_ref' from origin; branching off the last known local '$base_ref'"
      base_rev="$base_ref"
    fi
  fi
  # 

  worktree_path="$bare_dir/$branch_name"

  branch_exists=false
  if git --git-dir="$bare_dir" show-ref --verify --quiet "refs/heads/$branch_name"; then
    branch_exists=true
  fi

  worktree_registered=false
  if git --git-dir="$bare_dir" worktree list --porcelain 2>/dev/null | grep -F -x -q "worktree $worktree_path"; then
    worktree_registered=true
  fi

  if $worktree_registered && [[ ! -d "$worktree_path" ]]; then
    warn "  Worktree registration for $worktree_path is stale (directory missing); pruning"
    git --git-dir="$bare_dir" worktree prune
    worktree_registered=false
  fi

  if [[ -e "$worktree_path" ]] && ! $worktree_registered; then
    err "  $worktree_path exists but is not a registered worktree; refusing to touch it. Remove it manually and re-run."
    failures+=("$repo_bare_name")
    continue
  fi

  # PR mode always mirrors the freshly fetched origin ref: reset the local
  # branch to it before reusing/creating the worktree, so a moved PR head
  # is picked up on re-run instead of silently reviewing a stale tip.
  if $pr_mode && $branch_exists; then
    git --git-dir="$bare_dir" update-ref "refs/heads/$branch_name" "$base_rev"
    log "  Reset local branch '$branch_name' to '$base_rev'"
  fi

  if $worktree_registered; then
    log "  Worktree already exists at $worktree_path (reusing)"
    if $pr_mode; then
      if ! git -C "$worktree_path" reset --hard "$base_rev" >/dev/null; then
        err "  Failed to reset worktree at $worktree_path to '$base_rev'"
        failures+=("$repo_bare_name")
        continue
      fi
      log "  Reset worktree to '$base_rev'"
    fi
  elif $branch_exists; then
    log "  Branch '$branch_name' already exists; adding a worktree for it"
    if ! git --git-dir="$bare_dir" worktree add "$worktree_path" "$branch_name" >/dev/null; then
      err "  Failed to add worktree for existing branch '$branch_name'"
      failures+=("$repo_bare_name")
      continue
    fi
  else
    log "  Creating branch '$branch_name' from '$base_rev'"
    if ! git --git-dir="$bare_dir" worktree add -b "$branch_name" "$worktree_path" "$base_rev" >/dev/null; then
      err "  Failed to create branch/worktree '$branch_name'"
      failures+=("$repo_bare_name")
      continue
    fi
  fi
  # 

  worktree_real="$(cd "$worktree_path" && pwd -P)"
  bare_dir_real="$(cd "$bare_dir" && pwd -P)"

  if $pr_mode; then
    log "  PR mode: skipping .env link (read-only review)"
  else
    env_src="$bare_dir_real/.env"
    env_dst="$worktree_path/.env"
    if [[ -f "$env_src" ]]; then
      if [[ -e "$env_dst" || -L "$env_dst" ]]; then
        rm -f "$env_dst"
      fi
      rel_env="$(relpath "$env_src" "$worktree_real")"
      ln -s "$rel_env" "$env_dst"
      log "  Linked .env -> $rel_env"
    else
      warn "  No .env found at $env_src; skipping .env link"
    fi
  fi
  # 

  link_path="$target_dir/$repo_name"

  if [[ -L "$link_path" ]]; then
    rm -f "$link_path"
  elif [[ -e "$link_path" ]]; then
    err "  $link_path exists and is not a symlink; refusing to overwrite"
    failures+=("$repo_bare_name")
    continue
  fi

  rel_target="$(relpath "$worktree_real" "$target_dir")"
  ln -s "$rel_target" "$link_path"
  log "  Linked $link_path -> $rel_target"

  successes+=("$repo_bare_name")
  log ""
done

log "Done: ${#successes[@]} succeeded, ${#failures[@]} failed"
if [[ ${#failures[@]} -gt 0 ]]; then
  err "Failed repos: ${failures[*]}"
  exit 1
fi
