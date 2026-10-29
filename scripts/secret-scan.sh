#!/usr/bin/env bash
# Secret scan (gitleaks) of everything a task repo branch adds against its base branch.
# Usage: ./secret-scan.sh <repo-path> [base-branch]   (run from ~/work/<PROJECT>/tasks)
# base-branch defaults to origin/main; an origin/ base is fetched first.
# Scans commits since the merge base, staged, unstaged, and untracked files.
# Reports go to <task>/review/gitleaks-<repo>-<mode>.tsv (values redacted).
# Exit 0 when clean, 1 when there are secret findings or a scan error, 2 on usage error.
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage: $0 <repo-path> [base-branch]" >&2
  exit 2
fi

repo="${1%/}"
base="${2:-origin/main}"
case "$base" in
  origin/*)
    git -C "$repo" fetch -q origin "+refs/heads/${base#origin/}:refs/remotes/${base}" || echo "warning: fetch of $base failed; using the local ref" >&2
    ;;
esac
git -C "$repo" rev-parse --verify -q "$base^{commit}" >/dev/null || { echo "error: base '$base' not found in $repo" >&2; exit 2; }
mb="$(git -C "$repo" merge-base "$base" HEAD)"

GITLEAKS="$(command -v gitleaks || true)"
if [ -z "$GITLEAKS" ]; then
  echo "error: gitleaks not found" >&2
  exit 2
fi

tasks_root="$(cd "$(dirname "$0")" && pwd)"
config="$tasks_root/gitleaks.toml"
tmpl="$tasks_root/gitleaks-report.tmpl"
repo_name="$(basename "$repo")"
mkdir -p "$(dirname "$repo")/review"
review_dir="$(cd "$(dirname "$repo")/review" && pwd)"
log="$review_dir/gitleaks-$repo_name.log"
: > "$log"

# gitleaks exits 1 on a fatal error, so leaks use exit code 3 to tell them apart.
flags=(--no-banner --redact -c "$config" --exit-code 3 --report-format template --report-template "$tmpl")
lines=""
count=0

add_rows() {
  local mode="$1" report="$2" rule file line commit entry
  while IFS=$'\t' read -r rule file line commit; do
    [ -n "$rule" ] || continue
    entry="- $rule $file:$line ($mode"
    [ -n "$commit" ] && entry="$entry, commit ${commit:0:7}"
    lines="$lines$entry)"$'\n'
    count=$((count + 1))
  done < "$report"
}

check_rc() {
  local mode="$1" rc="$2"
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 3 ]; then
    lines="$lines- gitleaks error in $mode scan, see $log"$'\n'
    count=$((count + 1))
    return 1
  fi
}

run_git_scan() {
  local mode="$1" report="$review_dir/gitleaks-$repo_name-$1.tsv" rc=0
  shift
  : > "$report"
  "$GITLEAKS" git "$repo" "$@" "${flags[@]}" --report-path "$report" 2>>"$log" || rc=$?
  check_rc "$mode" "$rc" && add_rows "$mode" "$report"
  return 0
}

run_git_scan commits --log-opts="$mb..HEAD"
run_git_scan staged --staged
run_git_scan unstaged --pre-commit

untracked_report="$review_dir/gitleaks-$repo_name-untracked.tsv"
: > "$untracked_report"
tmp_report="$(mktemp)"
trap 'rm -f "$tmp_report"' EXIT
untracked_rc=0
while IFS= read -r p; do
  [ -n "$p" ] || continue
  rc=0
  # Run from the repo so the reported File is repo-relative, as in the git scans.
  (cd "$repo" && "$GITLEAKS" dir "$p" "${flags[@]}" --report-path "$tmp_report") 2>>"$log" || rc=$?
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 3 ]; then
    untracked_rc="$rc"
    continue
  fi
  cat "$tmp_report" >> "$untracked_report"
done <<EOF
$(git -C "$repo" ls-files --others --exclude-standard)
EOF
check_rc untracked "$untracked_rc" && add_rows untracked "$untracked_report"

echo "## Secrets in content (gitleaks)"
if [ -n "$lines" ]; then
  printf '%s' "$lines"
fi
if [ "$count" -eq 0 ]; then
  echo "RESULT: clean"
  exit 0
fi
echo "RESULT: $count secret finding(s)"
exit 1
