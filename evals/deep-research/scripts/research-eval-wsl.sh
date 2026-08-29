#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVAL_ROOT="$(cd "${SCRIPT_ROOT}/.." && pwd)"
EVAL_DEPS_ROOT="${DSH_RESEARCH_EVAL_DEPS:-${HOME}/.local/share/dsh-research-eval}"
NODE_ROOT="${EVAL_DEPS_ROOT}/runtime/node-v24.19.0"
BIN_ROOT="${HOME}/.local/bin"

export DSH_RESEARCH_EVAL_DEPS="${EVAL_DEPS_ROOT}"
export PATH="${NODE_ROOT}/bin:${BIN_ROOT}:${PATH}"

cd "${EVAL_ROOT}"
exec node src/run.mjs "$@"
