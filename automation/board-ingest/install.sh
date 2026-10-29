#!/usr/bin/env bash
#
# install.sh — register the weekday cron entry for run.sh.
#
# Idempotent: a second run replaces this job's entry rather than adding a
# duplicate. Unrelated crontab entries are always preserved.
#
# Usage:
#   ./install.sh                 # default schedule, 10:15 weekdays
#   ./install.sh "0 9 * * 1-5"   # any five-field cron schedule
#
# 

set -uo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SH="$SELF_DIR/run.sh"
SCHEDULE="${1:-15 10 * * 1-5}"

die() { echo "board-ingest install: $1" >&2; exit 1; }

[ -f "$RUN_SH" ] || die "run.sh not found at $RUN_SH"
[ -x "$RUN_SH" ] || chmod 755 "$RUN_SH" || die "cannot make run.sh executable"

# cron reads an unescaped % as a newline and would truncate the command.
case "$RUN_SH" in
  *%*) die "path contains '%', which cron cannot represent: $RUN_SH" ;;
esac
case "$SCHEDULE" in
  *%*) die "schedule contains '%', which cron treats as a newline" ;;
esac
# The path is single-quoted inside the cron command below; a literal
# single quote in the path would break out of that quoting.
case "$RUN_SH" in
  *\'*) die "path contains a single quote, which breaks the cron command: $RUN_SH" ;;
esac

TMP="$(mktemp)" || die "cannot create a temp file"
KEEP="$(mktemp)" || die "cannot create a temp file"
trap 'rm -f "$TMP" "$KEEP"' EXIT

crontab -l 2>/dev/null > "$TMP"

if grep -Fq "$RUN_SH" "$TMP"; then
  echo "board-ingest install: an entry exists; replacing it"
fi

# Drop only our own line. Everything else survives untouched.
grep -Fv "$RUN_SH" "$TMP" > "$KEEP" || true

# The installed command must run under a login shell, so the Azure
# DevOps variables from ~/.zprofile reach the MCP server.
CRON_CMD="/bin/zsh -lc '$RUN_SH'"
printf '%s %s\n' "$SCHEDULE" "$CRON_CMD" >> "$KEEP"

crontab "$KEEP" || die "crontab refused the update; grant Full Disk Access to your terminal in System Settings, Privacy & Security, then retry"

echo "board-ingest install: installed"
crontab -l | grep -F "$RUN_SH"
