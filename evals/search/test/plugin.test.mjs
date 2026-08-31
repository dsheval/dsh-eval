import assert from "node:assert/strict";
import test from "node:test";
import { resolveSource } from "../src/plugin.mjs";

test("source-link refuses relative paths that escape the declared dependency root", () => {
  const target = { install: { kind: "source-link", rootEnv: "TEST_ROOT", relativePath: "../escape", artifact: "lib/index.js" } };
  const result = resolveSource(target, { TEST_ROOT: "C:\\safe-root" });
  assert.equal(result.ok, false);
  assert.equal(result.state, "source-path-outside-root");
});

test("ordinary dsh-add targets need no local source tree", () => {
  const result = resolveSource({ install: { kind: "dsh-add", specs: ["plugin@1.0.0"] } }, {});
  assert.deepEqual(result, { ok: true, state: "not-required", path: null, artifactPath: null });
});
