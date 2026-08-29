#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-toolchain}"
EVAL_DEPS_ROOT="${DSH_RESEARCH_EVAL_DEPS:-${HOME}/.local/share/dsh-research-eval}"
RUNTIME_ROOT="${EVAL_DEPS_ROOT}/runtime"
SOURCE_ROOT="${EVAL_DEPS_ROOT}/sources"
BIN_ROOT="${HOME}/.local/bin"
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "${SCRIPT_ROOT}/../../.." && pwd)"
ARCHIVE_ROOT="${REPOSITORY_ROOT}/.research-eval-deps/archives"
NODE_VERSION="v24.19.0"
NODE_ARCH="x64"
NODE_ROOT="${RUNTIME_ROOT}/node-${NODE_VERSION}"
PNPM_VERSION="11.20.0"
DSH_VERSION="0.1.1-rc.2"
DSH_CLI_ROOT="${RUNTIME_ROOT}/dsh-${DSH_VERSION}"
P1_PNPM_VERSION="11.7.0"
P1_PNPM_ROOT="${RUNTIME_ROOT}/pnpm-${P1_PNPM_VERSION}"
P1_NPM_VERSION="10.9.4"
P1_NPM_ROOT="${RUNTIME_ROOT}/npm-${P1_NPM_VERSION}"
P1_COMMIT="79fdfc12acf19902213f082ccb7b7ad522ff6ccb"
P3_COMMIT="db9239cbd29e8726487de639cb7d3fdb0ed46b4e"
DSH_SOURCE_COMMIT="cd5ef8148158c3a752a658978873241fdf8e2bbc"
P1_ARCHIVE_SHA256="f1dc5276bdea615d4253de527beadd646ba932862e9b339202dd66ba5fe8726e"
P3_ARCHIVE_SHA256="41c364e11e0c52a54421f901ef96e45543264e9172161ceb168f8bb2154b0530"
DSH_ARCHIVE_SHA256="1507dab8f0d8fe91babb9bbf082591d3c1e6d505251ddeb8aa7dec292e137ac7"

install_toolchain() {
  install -d -m 0755 "${RUNTIME_ROOT}" "${SOURCE_ROOT}" "${BIN_ROOT}"
  if [[ ! -x "${NODE_ROOT}/bin/node" ]]; then
    local temp_dir
    temp_dir="$(mktemp -d /tmp/dsh-research-eval-node.XXXXXX)"
    case "${temp_dir}" in
      /tmp/dsh-research-eval-node.*) ;;
      *) echo "Unexpected temporary directory: ${temp_dir}" >&2; exit 1 ;;
    esac
    curl -fL --retry 3 \
      -o "${temp_dir}/node.tar.xz" \
      "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
    curl -fL --retry 3 \
      -o "${temp_dir}/SHASUMS256.txt" \
      "https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt"
    (
      cd "${temp_dir}"
      grep " node-${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz$" SHASUMS256.txt \
        | sed "s#node-${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz#node.tar.xz#" \
        | sha256sum -c -
    )
    install -d -m 0755 "${NODE_ROOT}"
    tar -xJf "${temp_dir}/node.tar.xz" --strip-components=1 -C "${NODE_ROOT}"
    rm -rf -- "${temp_dir}"
  fi

  ln -sfn "${NODE_ROOT}/bin/node" "${BIN_ROOT}/node"
  ln -sfn "${NODE_ROOT}/bin/npm" "${BIN_ROOT}/npm"
  ln -sfn "${NODE_ROOT}/bin/npx" "${BIN_ROOT}/npx"
  export PATH="${NODE_ROOT}/bin:${BIN_ROOT}:${PATH}"
  npm install --global "pnpm@${PNPM_VERSION}" --prefix "${NODE_ROOT}" --no-audit --no-fund
  ln -sfn "${NODE_ROOT}/bin/pnpm" "${BIN_ROOT}/pnpm"
  ln -sfn "${NODE_ROOT}/bin/pnpx" "${BIN_ROOT}/pnpx"

  node --version
  pnpm --version
}

install_dsh_cli() {
  install_toolchain
  export PATH="${NODE_ROOT}/bin:${BIN_ROOT}:${PATH}"
  install -d -m 0755 "${DSH_CLI_ROOT}"
  pnpm --dir "${DSH_CLI_ROOT}" add "@deepseek-ai/dsh@${DSH_VERSION}" --ignore-workspace \
    --allow-build="@deepseek-ai/dsh-subprocess-local,@google/genai,koffi,node-pty,protobufjs"
  ln -sfn "${DSH_CLI_ROOT}/node_modules/@deepseek-ai/dsh/lib/bin.js" "${BIN_ROOT}/dsh"
  dsh --version
}

install_p1_pnpm() {
  install_toolchain
  install -d -m 0755 "${P1_PNPM_ROOT}"
  npm install --prefix "${P1_PNPM_ROOT}" "pnpm@${P1_PNPM_VERSION}" --no-audit --no-fund
  install -d -m 0755 "${P1_NPM_ROOT}/bin"
  npm install --prefix "${P1_NPM_ROOT}" "npm@${P1_NPM_VERSION}" --no-audit --no-fund
  ln -sfn "${P1_NPM_ROOT}/node_modules/npm/bin/npm-cli.js" "${P1_NPM_ROOT}/bin/npm"
}

clone_source() {
  local url="$1"
  local destination="$2"
  local commit="$3"
  if [[ -d "${destination}/.git" ]]; then
    local actual
    actual="$(git -C "${destination}" rev-parse HEAD)"
    if [[ "${actual}" != "${commit}" ]]; then
      echo "Source commit mismatch at ${destination}: ${actual}" >&2
      exit 1
    fi
    return
  fi
  if [[ -e "${destination}" ]]; then
    echo "Refusing to overwrite non-git path: ${destination}" >&2
    exit 1
  fi
  git init "${destination}"
  git -C "${destination}" remote add origin "${url}"
  git -C "${destination}" fetch --depth 1 origin "${commit}"
  git -C "${destination}" checkout --detach FETCH_HEAD
}

clone_sources() {
  install_toolchain
  clone_source "https://github.com/hancao97/hanai-investment-dsh.git" "${SOURCE_ROOT}/worth-dsh" "${P1_COMMIT}"
  clone_source "https://github.com/lzszq/dsh-scholar.git" "${SOURCE_ROOT}/dsh-scholar" "${P3_COMMIT}"
  clone_source "https://github.com/deepseek-ai/deepseek-harness.git" "${SOURCE_ROOT}/deepseek-harness" "${DSH_SOURCE_COMMIT}"
  git -C "${SOURCE_ROOT}/worth-dsh" rev-parse HEAD
  git -C "${SOURCE_ROOT}/dsh-scholar" rev-parse HEAD
  git -C "${SOURCE_ROOT}/deepseek-harness" rev-parse HEAD
}

extract_source() {
  local archive="$1"
  local destination="$2"
  local expected_sha256="$3"
  if [[ ! -f "${archive}" ]]; then
    echo "Missing source archive: ${archive}" >&2
    exit 1
  fi
  echo "${expected_sha256}  ${archive}" | sha256sum -c -
  if [[ -d "${destination}" ]] && [[ -n "$(find "${destination}" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    echo "Source already present: ${destination}"
    return
  fi
  install -d -m 0755 "${destination}"
  tar -xzf "${archive}" --strip-components=1 -C "${destination}"
}

extract_archives() {
  install_toolchain
  extract_source "${ARCHIVE_ROOT}/worth-dsh.tar.gz" "${SOURCE_ROOT}/worth-dsh" "${P1_ARCHIVE_SHA256}"
  extract_source "${ARCHIVE_ROOT}/dsh-scholar.tar.gz" "${SOURCE_ROOT}/dsh-scholar" "${P3_ARCHIVE_SHA256}"
  extract_source "${ARCHIVE_ROOT}/deepseek-harness.tar.gz" "${SOURCE_ROOT}/deepseek-harness" "${DSH_ARCHIVE_SHA256}"
  test -f "${SOURCE_ROOT}/worth-dsh/package.json"
  test -f "${SOURCE_ROOT}/dsh-scholar/package.json"
  test -f "${SOURCE_ROOT}/deepseek-harness/package.json"
  echo "SOURCE_ARCHIVES_READY"
}

build_p1() {
  install_dsh_cli
  install_p1_pnpm
  local source_dir="${SOURCE_ROOT}/worth-dsh"
  local p1_pnpm="${P1_PNPM_ROOT}/node_modules/pnpm/bin/pnpm.cjs"
  test -f "${source_dir}/pnpm-lock.yaml"
  (
    cd "${source_dir}"
    export PATH="${P1_NPM_ROOT}/bin:${PATH}"
    node "${p1_pnpm}" install --frozen-lockfile
    node "${p1_pnpm}" run build
    node "${p1_pnpm}" run typecheck
    # Upstream pack:check parses npm's human-readable output, which changed in
    # newer npm releases. Verify the actual machine-readable package contents
    # instead so an output-format change cannot fail an otherwise valid build.
    npm pack --dry-run --json --ignore-scripts | node -e '
      let raw = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", chunk => { raw += chunk; });
      process.stdin.on("end", () => {
        // npm may forward lifecycle output before the JSON document.
        const marker = raw.lastIndexOf("\n[\n");
        const document = marker >= 0 ? raw.slice(marker + 1) : raw;
        const result = JSON.parse(document)[0];
        const files = new Set((result.files ?? []).map(file => file.path));
        const required = ["package.json", "lib/index.js", "lib/install-profile.js"];
        const missing = required.filter(file => !files.has(file));
        if (missing.length) {
          console.error(`P1 tarball missing: ${missing.join(", ")}`);
          process.exit(1);
        }
        console.log(`P1_TARBALL_READY ${result.filename}`);
      });
    '
  )
  test -f "${source_dir}/lib/install-profile.js"
  echo "P1_BUILD_READY"
}

build_p3() {
  install_dsh_cli
  local source_dir="${SOURCE_ROOT}/dsh-scholar"
  test -f "${source_dir}/pnpm-lock.yaml"
  (
    cd "${source_dir}"
    pnpm install --frozen-lockfile
    pnpm run build
    pnpm run verify:docs
  )
  test -f "${source_dir}/lib/index.js"
  echo "P3_BUILD_READY"
}

install_docker_engine() {
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "docker action requires an apt-based WSL distribution" >&2
    exit 1
  fi
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io
  systemctl enable --now docker
  docker info --format 'DOCKER_ENGINE_READY {{.ServerVersion}} {{.Driver}} {{.CgroupDriver}}'
}

case "${ACTION}" in
  toolchain) install_toolchain ;;
  dsh-cli) install_dsh_cli ;;
  sources) clone_sources ;;
  archives) extract_archives ;;
  build-p1) build_p1 ;;
  build-p3) build_p3 ;;
  docker) install_docker_engine ;;
  *) echo "Usage: $0 [toolchain|dsh-cli|sources|archives|build-p1|build-p3|docker]" >&2; exit 2 ;;
esac
