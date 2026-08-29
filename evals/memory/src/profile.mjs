import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const WEB_BUNDLES = ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"];
const PATCH = `# memory-eval patch layer
[]
`;
const PNPM_WORKSPACE = `packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false
allowBuilds:
  dsh-memory-evolve: true
  'dsh-memory-evolve@https://codeload.github.com/csyangwen/dsh-memory-evolve/tar.gz/1e6e7eb15ce515b0f2bd2142bdee9a36c46c8b91': true
`;
export const EVAL_AGENT_PRESET = "memory-eval";
export const EVAL_LIFECYCLE_PATCH = "memory-eval-lifecycle.patch.yml";
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const EVAL_LIFECYCLE_PLUGIN = "eval-lifecycle-plugin.mjs";
const LIFECYCLE_PATCH = `- insert:
    - id: memory-eval-lifecycle
      name: './${EVAL_LIFECYCLE_PLUGIN}'
`;
const EVAL_PRESET_META = `name: Memory Eval
description: Conversation-only agent for memory evaluation; no filesystem or shell shortcuts.
order: 99
`;
const EVAL_PRESET = `# Deliberately no generic shell, filesystem, search, skill, subagent, or web tools.
# Memory plugins may still contribute their own prompt sections and globally-scoped tools.
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    text: >-
      You are a concise conversational assistant participating in a memory evaluation.
      Answer the user's question directly from information genuinely available to you.
      If the information is unavailable, say that you do not know. Do not search local files,
      session logs, prior conversations, or the internet for an answer.
    includeRuntimeContext: true
`;

export function dshHome() {
  return process.env.DSH_HOME || join(homedir(), ".dsh");
}

export function profileDir(name, home = dshHome()) {
  return join(home, "profiles", name);
}

export function targetHome(baseHome, targetId) {
  const safe = String(targetId).replace(/[^A-Za-z0-9._-]+/g, "-");
  if (!safe) throw new Error("targetId 不能为空");
  return join(baseHome, "memory-eval-targets", safe);
}

export function prepareTargetHome(baseHome, targetId, options = {}) {
  const dir = targetHome(baseHome, targetId);
  if (options.fresh && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const name of [".credentials.yaml", "settings.yaml", ".anonymous-user-id"]) {
    const source = join(baseHome, name);
    const dest = join(dir, name);
    if (existsSync(source) && !existsSync(dest)) copyFileSync(source, dest);
  }
  return dir;
}

export function ensureProfile(options = {}) {
  const home = options.home ?? dshHome();
  const name = options.name ?? "memory-eval";
  const dir = profileDir(name, home);
  mkdirSync(dir, { recursive: true });

  const manifestPath = join(dir, "package.json");
  if (!existsSync(manifestPath)) {
    writeJson(manifestPath, {
      name: `dsh-profile-${name}`,
      private: true,
      dependencies: {},
      dsh: { profile: { bundles: [...WEB_BUNDLES] } },
    });
  } else {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const bundles = manifest.dsh?.profile?.bundles ?? [];
    const missing = WEB_BUNDLES.filter((item) => !bundles.includes(item));
    if (missing.length > 0) {
      manifest.dsh = manifest.dsh ?? {};
      manifest.dsh.profile = manifest.dsh.profile ?? {};
      manifest.dsh.profile.bundles = [...bundles, ...missing];
      writeJson(manifestPath, manifest);
    }
  }

  writeIfMissing(join(dir, "cordis.patch.yml"), PATCH);
  // This profile is owned by the evaluator.  Refresh the pnpm policy on every
  // run so a profile created by an older evaluator does not retain a stale
  // allowBuilds list and fail only when a git-hosted plugin is installed.
  writeFileSync(join(dir, "pnpm-workspace.yaml"), PNPM_WORKSPACE);
  copyFileSync(join(MODULE_DIR, EVAL_LIFECYCLE_PLUGIN), join(dir, EVAL_LIFECYCLE_PLUGIN));
  const lifecyclePatchPath = join(dir, EVAL_LIFECYCLE_PATCH);
  writeFileSync(lifecyclePatchPath, LIFECYCLE_PATCH);
  ensureEvalPreset(home);
  return { home, name, dir, lifecyclePatchPath };
}

export function ensureEvalPreset(home = dshHome()) {
  const dir = join(home, ".agent-presets", EVAL_AGENT_PRESET);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "preset.yml"), EVAL_PRESET_META);
  writeFileSync(join(dir, "agent.cordis.yml"), EVAL_PRESET);
  return dir;
}

// 工作区放 DSH home 下，不放评测根目录：评测会话里的模型能读父目录，
// 放在 fixtures/ 隔壁等于把答案递给它。
export function ensureWorkspaces(base = join(dshHome(), "memory-eval-workspaces")) {
  const a = join(base, "ws-a");
  const b = join(base, "ws-b");
  mkdirSync(a, { recursive: true });
  mkdirSync(b, { recursive: true });
  writeIfMissing(join(a, ".eval-workspace"), "a\n");
  writeIfMissing(join(b, ".eval-workspace"), "b\n");
  return { base, a, b };
}

function writeIfMissing(path, text) {
  if (!existsSync(path)) writeFileSync(path, text);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
