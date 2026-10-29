#!/usr/bin/env bash
#
# setup-task-lsp.sh — make a task folder a self-contained LSP + DAP
# workspace.
#
# For the given task_dir (a direct child of the directory this script
# lives in, or any directory holding repo symlinks in the same shape):
#   1. Link the shared .omp (skills, rules, agents, commands, mcp.json).
#   2. Install every repo present (uv sync / pnpm|npm install, plus
#      debugpy where missing).
#   3. Install the pinned task-folder LSP tooling from lsp-tooling/.
#   4. Write .task-root, pyrightconfig.json, lsp.json and dap.json.
# Then print a hint for the agent to call the move_session tool.
#
# Usage:
#   ./setup-task-lsp.sh <task_dir>
#
# Example (run from ~/work/<PROJECT>/tasks):
#   ./setup-task-lsp.sh BUG-12345-unauthorized-doc-download

set -uo pipefail

usage() {
  cat <<'EOF'
Usage: setup-task-lsp.sh <task_dir>

  task_dir  Task folder to bootstrap. If not an absolute path, it is
            resolved relative to the current directory.
EOF
}

log()  { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
err()  { printf 'ERROR: %s\n' "$*" >&2; }

# relpath TARGET BASE — relative path from BASE to TARGET.
# Both arguments must be absolute, symlink-resolved paths (no trailing slash).
# Copied verbatim from setup-task-branch.sh.
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

if [[ $# -ne 1 || "$1" == "-h" || "$1" == "--help" ]]; then
  usage
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
run_dir="$(pwd -P)"

task_dir_arg="$1"
case "$task_dir_arg" in
  /*) task_dir="$task_dir_arg" ;;
  *) task_dir="$run_dir/$task_dir_arg" ;;
esac

if [[ ! -d "$task_dir" ]]; then
  err "not a directory: $task_dir"
  exit 1
fi
task_dir="$(cd "$task_dir" && pwd -P)"

# Canonical debug-attach ports and uvicorn launch targets, from
# service-startup-reference.
declare -A ATTACH_PORTS=(
  [orchestrator]=5678
  [data-mcp]=5679
  [media-mcp]=5680
  [file-gateway]=5681
)
declare -A LAUNCH_MODULE=(
  [orchestrator]="app.main:app"
  [data-mcp]="src.main:app"
  [media-mcp]="src.main:app"
  [file-gateway]="src.main:app"
)
declare -A LAUNCH_PORT=(
  [orchestrator]=8000
  [data-mcp]=8002
  [media-mcp]=8001
  [file-gateway]=9000
)

log "Task dir:    $task_dir"
log ""

### 3a — repo discovery, LC_ALL=C sorted, byte-stable across runs.
shopt -s nullglob
candidates=("$task_dir"/*)
shopt -u nullglob

repo_names=()
for e in "${candidates[@]}"; do
  [[ -L "$e" && -d "$e" ]] || continue
  repo_names+=("$(basename "$e")")
done
if [[ ${#repo_names[@]} -gt 0 ]]; then
  IFS=$'\n' repo_names=($(LC_ALL=C sort <<<"${repo_names[*]}"))
  unset IFS
fi

python_repos=()
node_repos=()
for name in "${repo_names[@]}"; do
  repo_path="$task_dir/$name"
  if [[ -f "$repo_path/pyproject.toml" ]]; then
    python_repos+=("$name")
  elif [[ -f "$repo_path/package.json" ]]; then
    node_repos+=("$name")
  else
    warn "$name: no pyproject.toml or package.json, skipping"
  fi
done

### 3b — link the shared .omp.
hard_failures=()
omp_target="$script_dir/.omp"
omp_link="$task_dir/.omp"
if [[ -L "$omp_link" ]]; then
  rm -f "$omp_link"
elif [[ -e "$omp_link" ]]; then
  err "$omp_link exists and is not a symlink; refusing to overwrite"
  hard_failures+=(".omp")
fi
if [[ ! -e "$omp_link" ]]; then
  rel_omp="$(relpath "$omp_target" "$task_dir")"
  ln -s "$rel_omp" "$omp_link"
  log "Linked .omp -> $rel_omp"
fi

### 3c — install every repo, isolating failures.
install_successes=()
install_failures=()

for name in "${python_repos[@]}"; do
  repo_path="$task_dir/$name"
  log "== $name (python) =="
  if (cd "$repo_path" && uv sync); then
    if [[ ! -x "$repo_path/.venv/bin/debugpy" ]]; then
      if (cd "$repo_path" && uv pip install -p "$repo_path/.venv/bin/python" debugpy); then
        log "  Installed debugpy into $name/.venv"
      else
        err "  $name: failed to install debugpy"
        install_failures+=("$name")
        continue
      fi
    fi
    install_successes+=("$name")
  else
    err "  $name: uv sync failed"
    install_failures+=("$name")
  fi
  log ""
done

for name in "${node_repos[@]}"; do
  repo_path="$task_dir/$name"
  log "== $name (node) =="
  if [[ -f "$repo_path/pnpm-lock.yaml" ]]; then
    if (cd "$repo_path" && pnpm install --ignore-scripts); then
      install_successes+=("$name")
    else
      err "  $name: pnpm install failed"
      install_failures+=("$name")
    fi
  else
    if (cd "$repo_path" && npm install --ignore-scripts); then
      install_successes+=("$name")
    else
      err "  $name: npm install failed"
      install_failures+=("$name")
    fi
  fi
  log ""
done

### 3d — resolve the language-server binaries, repo first.
pyright_bin="$task_dir/node_modules/.bin/pyright-langserver"
for name in "${python_repos[@]}"; do
  cand="$task_dir/$name/.venv/bin/pyright-langserver"
  if [[ -x "$cand" ]]; then
    pyright_bin="$cand"
    break
  fi
done

ts_ls_bin="$task_dir/node_modules/.bin/typescript-language-server"
for name in "${node_repos[@]}"; do
  cand="$task_dir/$name/node_modules/.bin/typescript-language-server"
  if [[ -x "$cand" ]]; then
    ts_ls_bin="$cand"
    break
  fi
done

tsserver_js="$task_dir/node_modules/typescript/lib/tsserver.js"
for name in "${node_repos[@]}"; do
  cand="$task_dir/$name/node_modules/typescript/lib/tsserver.js"
  if [[ -f "$cand" ]]; then
    tsserver_js="$cand"
    break
  fi
done

### 3e — install the task-folder tooling, from the pinned template.
if [[ ${#python_repos[@]} -gt 0 || ${#node_repos[@]} -gt 0 ]]; then
  log "== task-folder tooling =="
  cp "$script_dir/lsp-tooling/package.json" "$task_dir/package.json"
  cp "$script_dir/lsp-tooling/pnpm-lock.yaml" "$task_dir/pnpm-lock.yaml"
  if ! (cd "$task_dir" && pnpm install --frozen-lockfile --ignore-scripts); then
    err "  task-folder tooling install failed"
    install_failures+=("lsp-tooling")
  fi
  log ""
fi

### 3f — write the root marker.
printf 'task lsp/dap root marker\n' >"$task_dir/.task-root"

### 3g — write pyrightconfig.json (only when a Python repo was found).
if [[ ${#python_repos[@]} -gt 0 ]]; then
  include_json=$(printf '%s\n' "${python_repos[@]}" | jq -R . | jq -s .)
  entry_jsons=()
  for name in "${python_repos[@]}"; do
    repo_path="$task_dir/$name"
    shopt -s nullglob
    matches=("$repo_path"/.venv/lib/python*/site-packages)
    shopt -u nullglob
    if [[ ${#matches[@]} -gt 0 ]]; then
      pydir="$(basename "$(dirname "${matches[0]}")")"
      pyver="${pydir#python}"
      site_rel="$name/.venv/lib/$pydir/site-packages"
      extra_json=$(jq -n --arg a "$name" --arg b "$site_rel" '[$a,$b]')
      entry_jsons+=("$(jq -n --arg root "$name" --arg ver "$pyver" --argjson extra "$extra_json" \
        '{root:$root, pythonVersion:$ver, extraPaths:$extra}')")
    else
      warn "$name: .venv missing after uv sync, pyrightconfig entry has no site-packages extraPath"
      extra_json=$(jq -n --arg a "$name" '[$a]')
      entry_jsons+=("$(jq -n --arg root "$name" --argjson extra "$extra_json" \
        '{root:$root, extraPaths:$extra}')")
    fi
  done
  exec_envs_json=$(printf '%s\n' "${entry_jsons[@]}" | jq -s .)
  jq -n --argjson include "$include_json" --argjson envs "$exec_envs_json" \
    '{include:$include, executionEnvironments:$envs}' >"$task_dir/pyrightconfig.json"
fi

### 3h — write lsp.json.
servers_json="{}"
if [[ ${#python_repos[@]} -gt 0 ]]; then
  servers_json=$(jq -n --argjson s "$servers_json" --arg cmd "$pyright_bin" \
    '$s + {pyright: {command:$cmd, rootMarkers: [".task-root"]}}')
fi
if [[ ${#python_repos[@]} -gt 0 || ${#node_repos[@]} -gt 0 ]]; then
  servers_json=$(jq -n --argjson s "$servers_json" --arg cmd "$ts_ls_bin" --arg tsserver "$tsserver_js" \
    '$s + {"typescript-language-server": {command:$cmd, rootMarkers: [".task-root"], initOptions: {tsserver: {path: $tsserver}}}}')
fi
jq -n --argjson servers "$servers_json" '{servers:$servers}' >"$task_dir/lsp.json"

### resolve_browser — first executable Chromium-based binary, in priority order.
resolve_browser() {
  local candidates=(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  )
  local c
  for c in "${candidates[@]}"; do
    if [[ -x "$c" ]]; then
      printf '%s' "$c"
      return 0
    fi
  done

  shopt -s nullglob
  local pw_dirs=("$HOME"/Library/Caches/ms-playwright/chromium-*)
  shopt -u nullglob
  local best="" best_n=-1
  local d base n n_val cand
  for d in "${pw_dirs[@]}"; do
    base="$(basename "$d")"
    n="${base#chromium-}"
    [[ "$n" =~ ^[0-9]+$ ]] || continue
    n_val=$((10#$n))
    if ((n_val > best_n)); then
      cand="$d/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
      if [[ -x "$cand" ]]; then
        best_n=$n_val
        best="$cand"
      fi
    fi
  done
  if [[ -n "$best" ]]; then
    printf '%s' "$best"
    return 0
  fi

  local brave="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  if [[ -x "$brave" ]]; then
    printf '%s' "$brave"
    return 0
  fi

  return 1
}

### resolve_js_debug_server — path to the standalone js-debug DAP server script.
### Mirrors OMP's own built-in "js-debug-adapter" auto-discovery candidates.
resolve_js_debug_server() {
  local candidates=(
    "${XDG_DATA_HOME:-$HOME/.local/share}/nvim/mason/packages/js-debug-adapter/js-debug/src/dapDebugServer.js"
    "$HOME/.local/opt/js-debug/src/dapDebugServer.js"
  )
  local c
  for c in "${candidates[@]}"; do
    if [[ -f "$c" ]]; then
      printf '%s' "$c"
      return 0
    fi
  done
  return 1
}

### 3i — write dap.json.
adapters_json="{}"
js_debug_server="$(resolve_js_debug_server)" || true
if [[ -z "$js_debug_server" ]]; then
  warn "no js-debug-adapter script found (checked mason and ~/.local/opt/js-debug), skipping all JS debug adapters"
fi

for name in "${python_repos[@]}"; do
  repo_path="$task_dir/$name"
  py_bin="$repo_path/.venv/bin/python"
  [[ -x "$py_bin" ]] || continue
  launch_json=$(jq -n --arg cwd "$repo_path" --arg py "$py_bin" \
    '{request:"launch", cwd:$cwd, python:[$py], justMyCode:false}')
  port="${ATTACH_PORTS[$name]:-}"
  if [[ -n "$port" ]]; then
    attach_json=$(jq -n --argjson port "$port" \
      '{request:"attach", justMyCode:false, connect:{host:"127.0.0.1", port:$port}}')
  else
    warn "$name: no canonical debug port, attach adapter emitted without a port"
    attach_json=$(jq -n '{request:"attach", justMyCode:false}')
  fi
  entry_json=$(jq -n --arg cmd "$py_bin" --argjson launch "$launch_json" --argjson attach "$attach_json" \
    '{command:$cmd, args:["-m","debugpy.adapter"], languages:["python"], launchDefaults:$launch, attachDefaults:$attach}')
  adapters_json=$(jq -n --argjson a "$adapters_json" --arg key "debugpy-$name" --argjson e "$entry_json" \
    '$a + {($key):$e}')
done

for name in "${node_repos[@]}"; do
  sym="$task_dir/$name"
  real="$(cd "$sym" && pwd -P)"

  runtime_exec=""
  if [[ -n "$js_debug_server" ]]; then
    runtime_exec="$(resolve_browser)" || true
  fi
  if [[ -n "$runtime_exec" ]]; then
    launch_https=$(jq -n --arg url "https://localhost:5173" --arg exe "$runtime_exec" --arg web "$sym" \
      '{type:"pwa-chrome", request:"launch", url:$url, runtimeExecutable:$exe, webRoot:$web, rootPath:$web,
        pathMapping:{"/":$web},
        outFiles:[($web+"/**/*.(m|c|)js"), "!**/node_modules/**"],
        resolveSourceMapLocations:[($web+"/**"), "!**/node_modules/**"],
        sourceMaps:true, timeout:20000}')
    launch_http=$(printf '%s' "$launch_https" | jq --arg url "http://localhost:5173" '.url=$url')
    attach_json=$(jq -n --arg web "$sym" \
      '{type:"pwa-chrome", request:"attach", address:"localhost", port:9222, targetSelection:"automatic",
        webRoot:$web, rootPath:$web, pathMapping:{"/":$web}, sourceMaps:true, timeout:20000}')
    entry_https=$(jq -n --arg js "$js_debug_server" --argjson launch "$launch_https" --argjson attach "$attach_json" \
      '{command:"node", args:[$js,"${port}","127.0.0.1"], connectMode:"tcp", languages:["javascript","typescript"], launchDefaults:$launch, attachDefaults:$attach}')
    entry_http=$(jq -n --arg js "$js_debug_server" --argjson launch "$launch_http" --argjson attach "$attach_json" \
      '{command:"node", args:[$js,"${port}","127.0.0.1"], connectMode:"tcp", languages:["javascript","typescript"], launchDefaults:$launch, attachDefaults:$attach}')
    adapters_json=$(jq -n --argjson a "$adapters_json" \
      --arg k1 "js-chrome-$name" --argjson e1 "$entry_https" \
      --arg k2 "js-chrome-$name-http" --argjson e2 "$entry_http" \
      '$a + {($k1):$e1, ($k2):$e2}')
  elif [[ -n "$js_debug_server" ]]; then
    warn "$name: no Chromium-based browser found, browser adapters skipped"
  fi

  if [[ -n "$js_debug_server" && -f "$sym/node_modules/vitest/vitest.mjs" ]]; then
    node_launch=$(jq -n --arg cwd "$real" --arg sym "$sym" \
      '{type:"pwa-node", request:"launch", cwd:$cwd, rootPath:$cwd, args:["run","--no-file-parallelism"],
        stopOnEntry:true,
        console:"internalConsole", autoAttachChildProcesses:true, skipFiles:["<node_internals>/**"], sourceMaps:true,
        outFiles:[($cwd+"/**/*.(m|c|)js"), "!**/node_modules/**"],
        resolveSourceMapLocations:[($cwd+"/**"), ($sym+"/**"), "!**/node_modules/**"]}')
    node_entry=$(jq -n --arg js "$js_debug_server" --argjson launch "$node_launch" \
      '{command:"node", args:[$js,"${port}","127.0.0.1"], connectMode:"tcp", languages:["javascript","typescript"], launchDefaults:$launch}')
    adapters_json=$(jq -n --argjson a "$adapters_json" --arg k "js-node-$name" --argjson e "$node_entry" \
      '$a + {($k):$e}')
  fi
done

jq -n --argjson adapters "$adapters_json" '{adapters:$adapters}' >"$task_dir/dap.json"

### 3ia — record the Python launch triples.
log "Python launch triples (program is always <repo>/.venv/bin/uvicorn):"
for name in "${python_repos[@]}"; do
  repo_path="$task_dir/$name"
  [[ -x "$repo_path/.venv/bin/python" ]] || continue
  module="${LAUNCH_MODULE[$name]:-}"
  if [[ -z "$module" ]]; then
    warn "$name: unknown launch target, no launch triple printed"
    continue
  fi
  port="${LAUNCH_PORT[$name]}"
  attach_port="${ATTACH_PORTS[$name]:-none}"
  log "  $name: program=$repo_path/.venv/bin/uvicorn args=[\"$module\", \"--host\", \"0.0.0.0\", \"--port\", \"$port\"] attach_port=$attach_port"
done
log ""

### 3j — final report.
log "Done: ${#install_successes[@]} succeeded, ${#install_failures[@]} failed"
if [[ ${#install_failures[@]} -gt 0 ]]; then
  err "Failed repos: ${install_failures[*]}"
fi
if [[ ${#hard_failures[@]} -gt 0 ]]; then
  err "Failed steps: ${hard_failures[*]}"
fi
if [[ ${#install_failures[@]} -gt 0 || ${#hard_failures[@]} -gt 0 ]]; then
  exit 1
fi

log "Setup complete. The agent now calls the move_session tool with this folder:"
log "  move_session $task_dir"
