#!/usr/bin/env bash
# Self-review of a task repo's diff against its base branch.
# Usage: ./self-review.sh <repo-path> [base-branch]   (run from ~/work/<PROJECT>/tasks)
# base-branch defaults to origin/main; an origin/ base is fetched first.
# <repo-path> is a task-folder repo symlink such as BUG-123-x/web-app.
# Writes the diff to <task>/review/self-<repo>.diff and runs ./secret-scan.sh (gitleaks)
# for the "Secrets in content" section.
# Exit 0 when clean, 1 when there are comment/env/secret findings, 2 on usage or scan error.
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
task_dir="$(dirname "$repo")"
review_dir="$task_dir/review"
diff_file="$review_dir/self-$(basename "$repo").diff"

mkdir -p "$review_dir"
untracked="$(git -C "$repo" ls-files --others --exclude-standard)"
git -C "$repo" --no-pager diff "$mb" > "$diff_file"
while IFS= read -r p; do
  [ -n "$p" ] || continue
  git -C "$repo" --no-pager diff --no-index -- /dev/null "$p" >> "$diff_file" || true
done <<EOF
$untracked
EOF

echo "## Files changed"
git -C "$repo" --no-pager diff --stat "$mb"
while IFS= read -r p; do
  [ -n "$p" ] || continue
  echo " $p (untracked)"
done <<EOF
$untracked
EOF

echo
echo "## New code comments"
comments="$(awk '
function kind(p) {
  if (p ~ /\.py$/) return "py"
  if (p ~ /\.(ts|tsx|js|jsx)$/) return "js"
  return ""
}
/^\+\+\+/ {
  file = substr($0, 5)
  sub(/\t.*$/, "", file)
  if (file == "/dev/null") file = ""; else if (file ~ /^b\//) file = substr(file, 3)
  next
}
/^\+/ {
  k = kind(file)
  if (k == "") next
  if ($0 ~ /^\+#!/) next
  hit = 0
  if (k == "py" && $0 ~ /^\+[ \t]*#/) hit = 1
  if (k == "js" && $0 ~ /^\+[ \t]*\/\//) hit = 1
  if (hit) {
    text = substr($0, 2)
    sub(/^[ \t]+/, "", text)
    print file ": " text
  }
}
' "$diff_file")"
comment_count=0
if [ -n "$comments" ]; then
  printf '%s\n' "$comments"
  comment_count="$(printf '%s\n' "$comments" | wc -l | tr -d ' ')"
fi

changed="$(git -C "$repo" --no-pager diff --name-only "$mb")"
if [ -n "$untracked" ]; then
  changed="$changed
$untracked"
fi

echo
echo "## Env and secret files"
env_count=0
dep_hits=""
notes=""
while IFS= read -r path; do
  [ -n "$path" ] || continue
  name="$(basename "$path")"
  lower="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]')"
  case "$lower" in
    .env.example)
      notes="${notes}${path}: .env.example, confirm the plan names it
"
      ;;
    .env|.env.*|*.pem|*.key|*.p12|*.pfx|id_rsa*)
      echo "$path"
      env_count=$((env_count + 1))
      ;;
    *secret*|*credential*)
      case "$lower" in
        *.json|*.yaml|*.yml|*.txt)
          echo "$path"
          env_count=$((env_count + 1))
          ;;
        *)
          notes="${notes}${path}: name suggests a secret; confirm it holds no value
"
          ;;
      esac
      ;;
  esac
  case "$name" in
    pnpm-lock.yaml|package.json|pyproject.toml|uv.lock|poetry.lock|requirements*.txt)
      dep_hits="${dep_hits}${path}: name it in the PR with a reason
"
      ;;
  esac
done <<EOF
$changed
EOF

echo
echo "## Dependency changes"
if [ -n "$dep_hits" ]; then
  printf '%s' "$dep_hits"
fi
echo
echo "## Notes"
if [ -n "$notes" ]; then
  printf '%s' "$notes"
fi

echo
scan_rc=0
scan_out="$("$(cd "$(dirname "$0")" && pwd)/secret-scan.sh" "$repo" "$base")" || scan_rc=$?
if [ "$scan_rc" -eq 2 ]; then
  echo "error: secret scan failed; run ./secret-scan.sh $repo $base for details" >&2
  exit 2
fi
printf '%s\n' "$scan_out" | sed '$d'
secret_count="$(printf '%s\n' "$scan_out" | grep -c '^- ' || true)"

echo
findings=$((comment_count + env_count + secret_count))
if [ "$findings" -eq 0 ]; then
  echo "RESULT: clean"
  exit 0
fi
echo "RESULT: $findings finding(s)"
exit 1
