#!/usr/bin/env bash
#
# run.sh — read the team Slack channels for one calendar day and file the
# findings in the wiki vault.
#
# Runs unattended from cron. Everything this job owns lives beside this
# script; the one external dependency is the token line in the project's
# ../../.ai-secrets file. Use ./install.sh and ./uninstall.sh to manage
# the cron entry; never hand-edit the crontab.
#
# The cd to the tasks root is load-bearing. OMP discovers project
# settings and MCP servers in <cwd>/.omp only and does not walk ancestor
# directories, so running from this folder would silently lose the Slack
# MCP server and the project tool denies. The cd also sets and exports
# PWD, which .omp/mcp.json needs for its ${PWD} Playwright paths.
#
# Usage:
#   ./run.sh              # finds every missing day since CRON_INSTALLED,
#                          # through yesterday, oldest first, one day at
#                          # a time; falls back to just yesterday when
#                          # the vault has no prior "daily scan" entry
#   ./run.sh 2026-09-05   # covers only the named day, no backfill
#
# Gap-fill: the vault log line "daily scan YYYY-MM-DD" is this job's own
# record of a day it actually covered. Normal mode reads every such line
# from the whole log, builds the full set of covered days from
# CRON_INSTALLED through yesterday, and processes whichever days are
# missing from that set, oldest first — not only the days after the
# newest covered day. A hole in the middle of the covered history (a
# missed cron firing, the laptop off, the operator OOO) is covered by
# the next firing exactly like a trailing gap; it is never permanently
# skipped just because a later day already got covered. MAX_BACKFILL_DAYS
# bounds how many missing days one firing processes, so a huge backlog
# spreads across firings instead of turning one wake-up into an
# unbounded run; anything past the cap is left for the next firing,
# never silently dropped.

set -uo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASKS_DIR="$(cd "$SELF_DIR/../.." && pwd)"

OMP_BIN="$HOME/.bun/bin/omp"
VAULT_DIR="<VAULT_ROOT>"
OVERLAY="$SELF_DIR/overlay.yml"
PROMPT_FILE="$SELF_DIR/prompt.md"
SESSION_DIR="$SELF_DIR/sessions"
LOG_FILE="$SELF_DIR/ingest.log"
SECRETS_FILE="$TASKS_DIR/.ai-secrets"

# The team channels, from vault://wiki/orgs/<CLIENT>.md slack_channels.
# Keep this list and that field in agreement.
CHANNELS=("#<team-channel-1>" "#<team-channel-2>" "#<team-channel-3>")
MAX_BACKFILL_DAYS=21
# The day this cron entry first ran for real (crontab -l: 0 11 * * 1-5).
# Automatic backfill never reaches earlier than this; pre-install history
# is out of scope for the job's own reliability guarantee.
CRON_INSTALLED="<YYYY-MM-DD>"

export PATH="$HOME/.bun/bin:$HOME/.local/share/fnm/aliases/default/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

die() { echo "slack-ingest: $1" >&2; exit 78; }

# Own the log only when nobody is watching. A manual run prints to the
# terminal; a cron run writes everything here, so cron itself sees no
# output and mails nothing.
if [ ! -t 1 ]; then
  if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 5000 ]; then
    tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
  fi
  exec >> "$LOG_FILE" 2>&1
fi

[ -x "$OMP_BIN" ] || die "omp not found at $OMP_BIN"
[ -f "$TASKS_DIR/.omp/mcp.json" ] || die "no .omp/mcp.json under $TASKS_DIR; this folder was moved"
[ -d "$VAULT_DIR" ] || die "vault not found at $VAULT_DIR"
[ -f "$OVERLAY" ] || die "overlay not found at $OVERLAY"
[ -f "$PROMPT_FILE" ] || die "prompt not found at $PROMPT_FILE"
[ -f "$SECRETS_FILE" ] || die "secrets file not found at $SECRETS_FILE"
[ "$(stat -f '%Lp' "$SECRETS_FILE")" = "600" ] || die "$SECRETS_FILE must be mode 600"

set -a
# shellcheck disable=SC1090
. "$SECRETS_FILE"
set +a

[ -n "${SLACK_MCP_XOXP_TOKEN:-}" ] || die "SLACK_MCP_XOXP_TOKEN is not set in $SECRETS_FILE"

mkdir -p "$SESSION_DIR" || die "cannot create $SESSION_DIR"
cd "$TASKS_DIR" || die "cannot cd to $TASKS_DIR"

CHANNEL_LIST="$(printf '%s, ' "${CHANNELS[@]}")"
CHANNEL_LIST="${CHANNEL_LIST%, }"

# run_one_day COVERED_DATE — one `omp -p` call for one calendar day.
# Not `exec`: the gap-fill loop below needs the shell alive to run the
# next day after this one finishes.
run_one_day() {
  local covered_date="$1"
  local run_date
  run_date="$(date +%F)"

  local prompt="$PROMPT_TEMPLATE"
  prompt="${prompt//@@CHANNELS@@/$CHANNEL_LIST}"
  prompt="${prompt//@@COVERED_DATE@@/$covered_date}"
  prompt="${prompt//@@RUN_DATE@@/$run_date}"

  echo "slack-ingest: start run=$run_date covered=$covered_date channels=$CHANNEL_LIST"
  "$OMP_BIN" -p \
    --config "$OVERLAY" \
    --model anthropic/claude-sonnet-5 \
    --thinking medium \
    --tools read,write,edit,grep,glob,todo \
    --skills 'wiki-*' \
    --no-lsp \
    --no-pty \
    --no-title \
    --add-dir "$VAULT_DIR" \
    --session-dir "$SESSION_DIR" \
    --max-time 20m \
    -- "$prompt"
}

PROMPT_TEMPLATE="$(cat "$PROMPT_FILE")"
YESTERDAY="$(TZ="${INGEST_TZ:-UTC}" date -v-1d +%F)"

if [ $# -ge 1 ]; then
  # Explicit date: cover only that day, no backfill. Manual/test usage.
  run_one_day "$1"
  exit $?
fi

# Gap-fill: build the full set of days already covered anywhere in the
# vault log (not just the newest), then walk every calendar day from
# CRON_INSTALLED through yesterday and collect the ones missing from
# that set. A day below the newest covered day is treated exactly like
# a day after it — neither is ever permanently skipped.
is_covered() {
  local d="$1" c
  # Bash 3.2 (macOS's /bin/bash, what cron's minimal PATH resolves
  # `env bash` to) throws "unbound variable" on "${COVERED[@]}" under
  # `set -u` when the array is empty. Guard before the expansion.
  [ "${#COVERED[@]}" -eq 0 ] && return 1
  for c in "${COVERED[@]}"; do
    [ "$c" = "$d" ] && return 0
  done
  return 1
}

COVERED=()
while IFS= read -r d; do
  [ -n "$d" ] && COVERED+=("$d")
done < <(grep -oE 'daily scan [0-9]{4}-[0-9]{2}-[0-9]{2}' "$VAULT_DIR/log.md" 2>/dev/null \
  | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | sort -u)

if [ "$(date -j -f %F "$CRON_INSTALLED" +%s)" -gt "$(date -j -f %F "$YESTERDAY" +%s)" ]; then
  echo "slack-ingest: nothing to do, CRON_INSTALLED ($CRON_INSTALLED) is after yesterday ($YESTERDAY)"
  exit 0
fi

MISSING=()
D="$CRON_INSTALLED"
while [ "$(date -j -f %F "$D" +%s)" -le "$(date -j -f %F "$YESTERDAY" +%s)" ]; do
  is_covered "$D" || MISSING+=("$D")
  D="$(date -j -f %F -v+1d "$D" +%F)"
done

TOTAL_MISSING="${#MISSING[@]}"
if [ "$TOTAL_MISSING" -eq 0 ]; then
  echo "slack-ingest: up to date, every day from $CRON_INSTALLED through $YESTERDAY is covered"
  exit 0
fi

# Process the oldest days first, up to the cap. Any remainder stays
# missing and is found again, and processed, by the next firing.
TO_RUN=("${MISSING[@]:0:$MAX_BACKFILL_DAYS}")
REMAINDER=$(( TOTAL_MISSING - ${#TO_RUN[@]} ))
echo "slack-ingest: $TOTAL_MISSING missing day(s) since $CRON_INSTALLED: ${MISSING[*]}"
echo "slack-ingest: processing the oldest ${#TO_RUN[@]}: ${TO_RUN[*]}"
if [ "$REMAINDER" -gt 0 ]; then
  echo "slack-ingest: $REMAINDER day(s) stay missing past the $MAX_BACKFILL_DAYS-day cap; a later run will continue them"
fi

# A day whose raw file already exists but has no matching log guard
# line cannot pass prompt.md's Step 1 guard; its Step 5 stop rule aborts
# with no write at all, so the day never joins COVERED and oldest-first
# would retry it, uselessly, first, every single firing. Skip it here
# instead: cheap, and it stops one stuck day from crowding out fresh
# missing days inside the MAX_BACKFILL_DAYS cap.
FAILED=()
STUCK=()
for D in "${TO_RUN[@]}"; do
  if [ -f "$VAULT_DIR/raw/$D-slack.md" ]; then
    STUCK+=("$D")
    echo "slack-ingest: day $D has raw/$D-slack.md but no log guard line; skipping automatic retry, needs manual reconciliation"
    continue
  fi
  if ! run_one_day "$D"; then
    FAILED+=("$D")
    echo "slack-ingest: day $D exited non-zero; continuing with the next day"
  fi
done

if [ "${#STUCK[@]}" -gt 0 ]; then
  echo "slack-ingest: ${#STUCK[@]} day(s) need manual reconciliation: ${STUCK[*]}"
fi

if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "slack-ingest: ${#FAILED[@]} day(s) failed this run: ${FAILED[*]}; still missing, retried next firing"
  exit 1
fi

exit 0
