#!/usr/bin/env bash
#
# install.sh — register the daily cron entry for run.sh.
#
# Idempotent: a second run replaces this job's entry rather than adding a
# duplicate. Unrelated crontab entries are always preserved.
#
# Usage:
#   ./install.sh                 # default schedule, 08:30 local, daily
#   ./install.sh "0 18 * * *"    # any five-field cron schedule
#
# 

set -uo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SH="$SELF_DIR/run.sh"
SCHEDULE="${1:-30 8 * * *}"

die() { echo "slack-ingest install: $1" >&2; exit 1; }

[ -f "$RUN_SH" ] || die "run.sh not found at $RUN_SH"
[ -x "$RUN_SH" ] || chmod 755 "$RUN_SH" || die "cannot make run.sh executable"

# cron reads an unescaped % as a newline and would truncate the command.
case "$RUN_SH" in
  *%*) die "path contains '%', which cron cannot represent: $RUN_SH" ;;
esac
case "$SCHEDULE" in
  *%*) die "schedule contains '%', which cron treats as a newline" ;;
esac

TMP="$(mktemp)" || die "cannot create a temp file"
KEEP="$(mktemp)" || die "cannot create a temp file"
trap 'rm -f "$TMP" "$KEEP"' EXIT

crontab -l 2>/dev/null > "$TMP"

if grep -Fq "$RUN_SH" "$TMP"; then
  echo "slack-ingest install: an entry exists; replacing it"
fi

# Drop only our own line. Everything else survives untouched.
grep -Fv "$RUN_SH" "$TMP" > "$KEEP" || true
printf '%s %s\n' "$SCHEDULE" "$RUN_SH" >> "$KEEP"

crontab "$KEEP" || die "crontab refused the update; grant Full Disk Access to your terminal in System Settings, Privacy & Security, then retry"

echo "slack-ingest install: installed"
crontab -l | grep -F "$RUN_SH"
