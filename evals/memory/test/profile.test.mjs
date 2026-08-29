import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  EVAL_AGENT_PRESET,
  ensureEvalPreset,
  ensureProfile,
  prepareTargetHome,
} from "../src/profile.mjs";

test("评测 preset 不提供通用文件和终端旁路", () => {
  const home = mkdtempSync(join(tmpdir(), "memory-eval-home-"));
  ensureProfile({ home, name: "memory-eval" });
  const dir = ensureEvalPreset(home);
  const composition = readFileSync(join(dir, "agent.cordis.yml"), "utf8");
  const profile = join(home, "profiles", "memory-eval");
  const workspace = readFileSync(join(profile, "pnpm-workspace.yaml"), "utf8");
  const lifecyclePatch = readFileSync(join(profile, "memory-eval-lifecycle.patch.yml"), "utf8");
  const lifecyclePlugin = readFileSync(join(profile, "eval-lifecycle-plugin.mjs"), "utf8");
  assert.equal(EVAL_AGENT_PRESET, "memory-eval");
  assert.match(composition, /dsh-persona/);
  assert.match(composition, /includeRuntimeContext:\s*true/);
  assert.doesNotMatch(composition, /dsh-tool-(?:pwsh|bash|fs|fs-search|web|skill|subagent)/);
  assert.match(workspace, /allowBuilds:\s+[\s\S]*dsh-memory-evolve: true/);
  assert.match(
    workspace,
    /dsh-memory-evolve@https:\/\/codeload\.github\.com\/csyangwen\/dsh-memory-evolve\/tar\.gz\/1e6e7eb15ce515b0f2bd2142bdee9a36c46c8b91': true/,
  );
  assert.match(lifecyclePatch, /memory-eval-lifecycle/);
  assert.match(lifecyclePlugin, /process\.emit\("SIGTERM"\)/);
});

test("评测 profile 会刷新 pnpm 构建许可而不是保留旧配置", () => {
  const home = mkdtempSync(join(tmpdir(), "memory-eval-pnpm-home-"));
  ensureProfile({ home, name: "memory-eval" });
  const workspacePath = join(home, "profiles", "memory-eval", "pnpm-workspace.yaml");
  writeFileSync(workspacePath, "packages:\n  - .\nallowBuilds: {}\n");

  ensureProfile({ home, name: "memory-eval" });

  const workspace = readFileSync(workspacePath, "utf8");
  assert.match(workspace, /allowBuilds:\s+[\s\S]*dsh-memory-evolve: true/);
  assert.match(workspace, /dsh-memory-evolve@https:\/\/codeload\.github\.com[\s\S]*: true/);
  assert.doesNotMatch(workspace, /allowBuilds: \{\}/);
});

test("每个插件使用独立 DSH_HOME，fresh 会清理本插件残留", () => {
  const base = mkdtempSync(join(tmpdir(), "memory-eval-base-"));
  writeFileSync(join(base, ".credentials.yaml"), "credential: test\n");
  const first = prepareTargetHome(base, "P1", { fresh: true });
  writeFileSync(join(first, "plugin-memory.db"), "dirty");
  const second = prepareTargetHome(base, "P2", { fresh: true });
  assert.notEqual(first, second);
  assert.equal(readFileSync(join(first, ".credentials.yaml"), "utf8"), "credential: test\n");
  prepareTargetHome(base, "P1", { fresh: true });
  assert.equal(existsSync(join(first, "plugin-memory.db")), false);
});

test("第三方插件目标不复制日常凭据，只接受显式专用凭据", () => {
  const base = mkdtempSync(join(tmpdir(), "memory-eval-credentials-"));
  writeFileSync(join(base, ".credentials.yaml"), "credential: daily\n");
  const isolated = prepareTargetHome(base, "P1", {
    fresh: true,
    copyBaseCredentials: false,
  });
  assert.equal(existsSync(join(isolated, ".credentials.yaml")), false);

  const dedicated = join(base, "short-lived.credentials.yaml");
  writeFileSync(dedicated, "credential: short-lived\n");
  prepareTargetHome(base, "P1", {
    credentialsPath: dedicated,
    copyBaseCredentials: false,
  });
  assert.equal(
    readFileSync(join(isolated, ".credentials.yaml"), "utf8"),
    "credential: short-lived\n",
  );
});
