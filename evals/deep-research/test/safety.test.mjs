import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { safeError } from "../src/lib.mjs";
import { loadConfiguration } from "../src/config.mjs";
import { assertExecutionAuthorized, targetProcessEnv, taskPrompt, taskSessionPayload } from "../src/runner.mjs";

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

test("安装环境保留 WSL 依赖根并覆盖隔离 DSH_HOME", () => {
  const env = targetProcessEnv("/isolated/dsh", {
    DSH_HOME: "/old/dsh",
    DSH_RESEARCH_EVAL_DEPS: "/deps",
  });
  assert.equal(env.DSH_HOME, "/isolated/dsh");
  assert.equal(env.DSH_RESEARCH_EVAL_DEPS, "/deps");
});

test("题目会话直接绑定隔离工作区 cwd", () => {
  assert.deepEqual(taskSessionPayload("/isolated/R6-attempt-1"), { cwd: "/isolated/R6-attempt-1" });
});

test("统一研究协议只注入长文题且包含可执行上限", () => {
  const config = loadConfiguration();
  const shortFact = config.suite.tasks.find((task) => task.id === "R1");
  const longForm = config.suite.tasks.find((task) => task.id === "R6");
  assert.equal(taskPrompt(config, shortFact), shortFact.prompt);
  assert.match(taskPrompt(config, longForm), /bounded-evidence-v1/);
  assert.match(taskPrompt(config, longForm), /at most 4 subagents/);
  assert.match(taskPrompt(config, longForm), /do not repeatedly call list_agents/i);
});

test("错误脱敏保留预算错误码但移除真实 Key", () => {
  assert.equal(
    safeError(new Error("TASK_TIME_BUDGET_EXCEEDED: reached")),
    "TASK_TIME_BUDGET_EXCEEDED: reached",
  );
  assert.equal(safeError(new Error("key sk-abcdefghijklmnop")), "key [REDACTED]");
  assert.equal(safeError(new Error("Bearer abcdefghijklmnop")), "Bearer [REDACTED]");
});

test("pnpm 原生依赖许可逐项传递，不能合并成一个无效包名", () => {
  const source = readFileSync(new URL("../scripts/prepare-wsl.sh", import.meta.url), "utf8");
  const expected = ["@deepseek-ai/dsh-subprocess-local", "@google/genai", "koffi", "node-pty", "protobufjs"];
  for (const packageName of expected) {
    assert.match(source, new RegExp(`--allow-build="${packageName.replace("/", "\\/")}"`));
  }
  assert.doesNotMatch(source, /--allow-build="[^"]*,[^"]*"/);
});

test("WSL 正式入口默认拒绝误用 root 账户", () => {
  const source = readFileSync(new URL("../scripts/research-eval-wsl.sh", import.meta.url), "utf8");
  assert.match(source, /EUID/);
  assert.match(source, /Refusing to run the formal evaluation as root/);
  assert.match(source, /DSH_RESEARCH_EVAL_ALLOW_ROOT/);
  assert.match(source, /NODE_USE_ENV_PROXY/);
  assert.match(source, /network-check/);
});
