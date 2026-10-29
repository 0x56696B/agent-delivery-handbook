#!/usr/bin/env bash
#
# uninstall.sh — remove the cron entry that install.sh registered.
#
# Removes only this job's line. Unrelated crontab entries are preserved.
# The ingest.log file and the sessions/ folder are left alone; they are
# the audit trail. Delete them by hand if you want them gone.
#
# Usage:
#   ./uninstall.sh
#
# 

set -uo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SH="$SELF_DIR/run.sh"

die() { echo "slack-ingest uninstall: $1" >&2; exit 1; }

TMP="$(mktemp)" || die "cannot create a temp file"
KEEP="$(mktemp)" || die "cannot create a temp file"
trap 'rm -f "$TMP" "$KEEP"' EXIT

crontab -l 2>/dev/null > "$TMP"

if ! grep -Fq "$RUN_SH" "$TMP"; then
  echo "slack-ingest uninstall: no entry found; nothing to do"
  exit 0
fi

grep -Fv "$RUN_SH" "$TMP" > "$KEEP" || true

if [ -s "$KEEP" ]; then
  crontab "$KEEP" || die "crontab refused the update; grant Full Disk Access to your terminal in System Settings, Privacy & Security, then retry"
else
  # An empty file would leave an empty crontab; remove it outright.
  crontab -r 2>/dev/null || true
fi

echo "slack-ingest uninstall: removed"
