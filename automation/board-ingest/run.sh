#!/usr/bin/env bash
#
# run.sh — read the Azure DevOps board state and file it in the wiki
# vault, with a morning brief of tickets whose pull requests have merged.
#
# Runs unattended from cron. Everything this job owns lives beside this
# script; the one external dependency is the Azure DevOps login-shell
# environment (CLIENT_AZURE_DEVOPS_ORG, CLIENT_AZURE_PAT). Use
# ./install.sh and ./uninstall.sh to manage the cron entry; never
# hand-edit the crontab.
#
# The cd to the tasks root is load-bearing. OMP discovers project
# settings and MCP servers in <cwd>/.omp only and does not walk ancestor
# directories, so running from this folder would silently lose the
# Azure DevOps MCP server and the project tool denies. The cd also sets
# and exports PWD, which .omp/mcp.json needs for its ${PWD} Playwright
# paths.
#
# This job never writes to Azure DevOps. The overlay denies every
# Azure DevOps write tool; the prompt's own allowlist is the soft
# guarantee behind the same rule.
#
# Usage:
#   ./run.sh              # snapshot as of today, in $INGEST_TZ (default UTC)
#   ./run.sh 2026-09-18   # snapshot labelled with the named date, for a replay
#
# 

set -uo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASKS_DIR="$(cd "$SELF_DIR/../.." && pwd)"

OMP_BIN="$HOME/.bun/bin/omp"
VAULT_DIR="<VAULT_ROOT>"
OVERLAY="$SELF_DIR/overlay.yml"
PROMPT_FILE="$SELF_DIR/prompt.md"
SESSION_DIR="$SELF_DIR/sessions"
LOG_FILE="$SELF_DIR/board.log"

export PATH="$HOME/.bun/bin:$HOME/.local/share/fnm/aliases/default/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

die() { echo "board-ingest: $1" >&2; exit 78; }

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

: "${CLIENT_AZURE_DEVOPS_ORG:=<ADO_ORG>}"
export CLIENT_AZURE_DEVOPS_ORG
[ -n "${CLIENT_AZURE_PAT:-}" ] || die "CLIENT_AZURE_PAT is not set; run this script through a login shell, e.g. /bin/zsh -lc '$SELF_DIR/run.sh'"

mkdir -p "$SESSION_DIR" || die "cannot create $SESSION_DIR"
cd "$TASKS_DIR" || die "cannot cd to $TASKS_DIR"

RUN_DATE="${1:-$(TZ="${INGEST_TZ:-UTC}" date +%F)}"

PROMPT="$(cat "$PROMPT_FILE")"
PROMPT="${PROMPT//@@RUN_DATE@@/$RUN_DATE}"

echo "board-ingest: start run=$RUN_DATE"
exec "$OMP_BIN" -p \
  --config "$OVERLAY" \
  --model anthropic/claude-sonnet-5 \
  --thinking medium \
  --tools read,write,edit,grep,glob,todo \
  --no-skills \
  --no-lsp \
  --no-pty \
  --no-title \
  --add-dir "$VAULT_DIR" \
  --session-dir "$SESSION_DIR" \
  --max-time 25m \
  -- "$PROMPT"
