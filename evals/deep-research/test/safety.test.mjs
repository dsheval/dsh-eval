import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assertExecutionAuthorized } from "../src/runner.mjs";

test("正式运行必须通过双重安全锁", () => {
  const previous = process.env.DSH_RESEARCH_EVAL_EXECUTE;
  delete process.env.DSH_RESEARCH_EVAL_EXECUTE;
  assert.throws(() => assertExecutionAuthorized({ execute: true }), /安全锁/);
  process.env.DSH_RESEARCH_EVAL_EXECUTE = "I_UNDERSTAND_THIS_STARTS_DSH";
  assert.throws(() => assertExecutionAuthorized({ execute: false }), /安全锁/);
  assert.doesNotThrow(() => assertExecutionAuthorized({ execute: true }));
  if (previous == null) delete process.env.DSH_RESEARCH_EVAL_EXECUTE;
  else process.env.DSH_RESEARCH_EVAL_EXECUTE = previous;
});

test("Host 从隔离 DSH_HOME 启动而不是评测目录", () => {
  const source = readFileSync(new URL("../src/runner.mjs", import.meta.url), "utf8");
  const startBlock = source.match(/handle = startHost\(\{[\s\S]*?\}\);/)?.[0] ?? "";
  assert.match(startBlock, /cwd:\s*home/);
  assert.doesNotMatch(startBlock, /cwd:\s*EVAL_ROOT/);
});

test("pnpm 原生依赖许可逐项传递，不能合并成一个无效包名", () => {
  const source = readFileSync(new URL("../scripts/prepare-wsl.sh", import.meta.url), "utf8");
  const expected = ["@deepseek-ai/dsh-subprocess-local", "@google/genai", "koffi", "node-pty", "protobufjs"];
  for (const packageName of expected) {
    assert.match(source, new RegExp(`--allow-build="${packageName.replace("/", "\\/")}"`));
  }
  assert.doesNotMatch(source, /--allow-build="[^"]*,[^"]*"/);
});
