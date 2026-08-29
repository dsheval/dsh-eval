import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { preflightTarget, resolveSource } from "../src/plugin.mjs";

function sourceTarget(overrides = {}) {
  return {
    id: "PX",
    plugin: "source-plugin",
    platforms: [process.platform],
    requiredCredentialRefs: [],
    optionalCredentialRefs: [],
    install: {
      kind: "source-add",
      rootEnv: "TEST_SOURCE_ROOT",
      relativePath: "sources/plugin",
      artifact: "lib/index.js",
      ...overrides,
    },
  };
}

test("源码插件只有构建产物存在时通过准入", () => {
  const root = mkdtempSync(join(tmpdir(), "research-eval-source-"));
  const target = sourceTarget();
  assert.equal(preflightTarget(target, { credentialHome: root, env: {} }).ok, false);
  mkdirSync(join(root, "sources", "plugin", "lib"), { recursive: true });
  writeFileSync(join(root, "sources", "plugin", "lib", "index.js"), "export {};\n");
  const row = preflightTarget(target, { credentialHome: root, env: { TEST_SOURCE_ROOT: root } });
  assert.equal(row.ok, true);
  assert.equal(row.sourceState, "ready");
});

test("源码路径不能逃出声明的依赖根目录", () => {
  const root = mkdtempSync(join(tmpdir(), "research-eval-source-"));
  const resolved = resolveSource(sourceTarget({ relativePath: "../outside" }), { TEST_SOURCE_ROOT: root });
  assert.equal(resolved.ok, false);
  assert.equal(resolved.state, "source-path-outside-root");
});
