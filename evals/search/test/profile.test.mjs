import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ensureSearchEvalPreset, prepareTargetHome } from "../src/profile.mjs";

test("isolated homes copy required credentials but omit optional credentials", () => {
  const base = join(tmpdir(), `dsh-search-profile-${process.pid}-${Date.now()}`);
  mkdirSync(base, { recursive: true });
  writeFileSync(join(base, ".credentials.yaml"), "DEEPSEEK_API_KEY: deep-value\nTAVILY_API_KEY: optional-value\n");
  const oldDeepSeek = process.env.DEEPSEEK_API_KEY;
  const oldTavily = process.env.TAVILY_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.TAVILY_API_KEY;
  try {
    const target = prepareTargetHome(base, "S1", { fresh: true, credentialRefs: ["DEEPSEEK_API_KEY"] });
    const copied = readFileSync(join(target, ".credentials.yaml"), "utf8");
    assert.match(copied, /DEEPSEEK_API_KEY/u);
    assert.doesNotMatch(copied, /TAVILY_API_KEY/u);
  } finally {
    if (oldDeepSeek == null) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = oldDeepSeek;
    if (oldTavily == null) delete process.env.TAVILY_API_KEY; else process.env.TAVILY_API_KEY = oldTavily;
    rmSync(base, { recursive: true, force: true });
  }
});

test("search evaluation preset exposes web search without artifact or coding tools", () => {
  const base = join(tmpdir(), `dsh-search-preset-${process.pid}-${Date.now()}`);
  mkdirSync(base, { recursive: true });
  try {
    const first = ensureSearchEvalPreset(base, "search-eval");
    const second = ensureSearchEvalPreset(base, "search-eval");
    const composition = readFileSync(join(first.dir, "agent.cordis.yml"), "utf8");
    assert.equal(first.sha256, second.sha256);
    assert.match(composition, /id: tool-web/u);
    assert.match(composition, /includeRuntimeContext: false/u);
    assert.doesNotMatch(composition, /complete: true/u);
    for (const forbidden of ["tool-skill", "tool-pwsh", "tool-bash", "tool-fs", "tool-subagent", "tool-goal", "tool-cordis"]) {
      assert.doesNotMatch(composition, new RegExp(`id: ${forbidden}\\b`, "u"));
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
