#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 && "${DSH_RESEARCH_EVAL_ALLOW_ROOT:-0}" != "1" ]]; then
  echo "Refusing to run the formal evaluation as root. Use the dedicated dsheval user, or set DSH_RESEARCH_EVAL_ALLOW_ROOT=1 for an intentional isolated root environment." >&2
  exit 2
fi

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVAL_ROOT="$(cd "${SCRIPT_ROOT}/.." && pwd)"
EVAL_DEPS_ROOT="${DSH_RESEARCH_EVAL_DEPS:-${HOME}/.local/share/dsh-research-eval}"
NODE_ROOT="${EVAL_DEPS_ROOT}/runtime/node-v24.19.0"
BIN_ROOT="${HOME}/.local/bin"

export DSH_RESEARCH_EVAL_DEPS="${EVAL_DEPS_ROOT}"
export PATH="${NODE_ROOT}/bin:${BIN_ROOT}:${PATH}"

configure_windows_proxy() {
  if [[ -n "${HTTPS_PROXY:-${https_proxy:-}}" ]]; then
    export NODE_USE_ENV_PROXY=1
    return
  fi
  local powershell_path="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
  [[ -x "${powershell_path}" ]] || return
  local proxy_server
  proxy_server="$("${powershell_path}" -NoProfile -NonInteractive -Command "(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings').ProxyServer" 2>/dev/null | tr -d '\r' | tail -n 1)" || true
  if [[ "${proxy_server}" =~ ^127\.0\.0\.1:([0-9]+)$ ]]; then
    local gateway
    gateway="$(ip route show default | awk '{print $3; exit}')"
    if [[ -n "${gateway}" ]]; then
      export HTTP_PROXY="http://${gateway}:${BASH_REMATCH[1]}"
      export HTTPS_PROXY="${HTTP_PROXY}"
      export http_proxy="${HTTP_PROXY}"
      export https_proxy="${HTTPS_PROXY}"
      export NO_PROXY="127.0.0.1,localhost,::1"
      export no_proxy="${NO_PROXY}"
      export NODE_USE_ENV_PROXY=1
    fi
  fi
}

probe_url() {
  local label="$1"
  local url="$2"
  node -e '
    const [label, url] = process.argv.slice(1);
    fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) })
      .then((response) => console.error(`network probe ${label}: HTTP ${response.status}`))
      .catch((error) => { console.error(`network probe ${label} failed: ${error.message}`); process.exit(1); });
  ' "${label}" "${url}"
}

configure_windows_proxy

if [[ "${1:-}" == "network-check" ]]; then
  probe_url "DeepSeek" "https://api.deepseek.com/"
  probe_url "GitHub" "https://github.com/"
  exit 0
fi

if [[ "${1:-}" == "run" ]]; then
  probe_url "DeepSeek" "https://api.deepseek.com/"
  probe_url "GitHub" "https://github.com/"
fi

cd "${EVAL_ROOT}"
exec node src/run.mjs "$@"
