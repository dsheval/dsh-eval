import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  DEFAULT_PRIVATE_TASKS,
  buildPlan,
  hydrateSuite,
  loadConfiguration,
  selectTasks,
  validateConfiguration,
} from "../src/config.mjs";
import { readJson } from "../src/lib.mjs";

test("公开配置能校验，缺私有短事实只给 warning", () => {
  const config = loadConfiguration({ privatePath: join(process.cwd(), "fixtures", "__missing-private-tasks.json") });
  const result = validateConfiguration(config);
  assert.equal(result.ok, true);
  assert.ok(result.issues.some((issue) => issue.level === "warning" && issue.path.includes("R1.prompt")));
  assert.ok(result.issues.some((issue) => issue.level === "warning" && issue.path.includes("benchmarkSource")));
});

test("正式配置必须补齐紧凑版 R1/R3 私有题面、gold 和来源", () => {
  const config = loadConfiguration({ privatePath: join(process.cwd(), "fixtures", "__missing-private-tasks.json") });
  const strictBefore = validateConfiguration(config, { requireRunnable: true });
  assert.equal(strictBefore.ok, false);

  const source = readJson(config.paths.suitePath);
  const suite = hydrateSuite(source, {
    R1: { prompt: "短事实题一", gold: ["答案一"], benchmarkSource: { taskId: "source.1" } },
    R4: { prompt: "短事实题三", gold: ["答案三"], benchmarkSource: { taskId: "source.3" } },
  });
  const strictAfter = validateConfiguration({ ...config, suite }, { requireRunnable: true });
  assert.equal(strictAfter.ok, true, JSON.stringify(strictAfter.issues));

  const templateSuite = hydrateSuite(source, {
    R1: { prompt: "填写冻结后的题面", gold: ["填写答案"], benchmarkSource: { taskId: "source.1" } },
    R4: { prompt: "待补题面", gold: ["答案三"], benchmarkSource: { taskId: "source.3" } },
  });
  const templateResult = validateConfiguration({ ...config, suite: templateSuite }, { requireRunnable: true });
  assert.equal(templateResult.ok, false);
  assert.ok(templateResult.issues.some((issue) => issue.message.includes("占位符")));
});

test("本机冻结的五项紧凑题集可正式预检", { skip: !existsSync(DEFAULT_PRIVATE_TASKS) }, () => {
  const config = loadConfiguration();
  const result = validateConfiguration(config, { requireRunnable: true });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.equal(config.suite.tasks.filter((task) => task.benchmarkSource?.taskId).length, 4);
  assert.deepEqual(config.suite.tasks.map((task) => task.id), ["R1", "R3", "R6", "R7", "R10"]);
});

test("计划是 C0+7 个入围插件，P7 排除，题型结构保持不变", () => {
  const config = loadConfiguration();
  const plan = buildPlan(config);
  assert.equal(plan.safe, true);
  assert.equal(plan.startsDsh, false);
  assert.equal(plan.callsModel, false);
  assert.equal(plan.judgeEnabled, true);
  assert.equal(plan.targets.length, 8);
  assert.equal(plan.targets.some((target) => target.id === "P7"), false);
  assert.equal(plan.targets[0].tasks.filter((task) => task.mode === "normal").length, 4);
  assert.equal(plan.targets[0].tasks.filter((task) => task.mode === "interrupt").length, 0);
  assert.equal(plan.targets[0].tasks.filter((task) => task.mode === "derived").length, 1);
  assert.equal(config.suite.tasks.find((task) => task.id === "R10").sourceTask, "R6");
  assert.equal(plan.targets[0].tasks.find((task) => task.id === "R1").budget.maxToolCalls, null);
  assert.equal(plan.targets[0].tasks.find((task) => task.id === "R1").budget.maxBudgetedCalls, 40);
  assert.deepEqual(
    Object.fromEntries(["SF", "LF", "PRODUCT"].map((track) => [track, plan.targets[0].tasks.filter((task) => task.track === track).length])),
    { SF: 2, LF: 2, PRODUCT: 1 },
  );
  assert.equal(config.suite.execution.taskTimeoutMs, null);
  assert.deepEqual(config.suite.tasks.filter((task) => task.timeoutMs != null).map((task) => task.id), ["R6", "R7"]);
  assert.equal(config.suite.execution.budgets.SF.maxSearchCalls, 12);
  assert.equal(config.suite.execution.budgets.LF.maxSearchCalls, 24);
  assert.ok(Object.values(config.suite.execution.budgets).every((budget) => budget.maxToolCalls === null));
  assert.equal(config.suite.execution.researchProtocol.id, "bounded-evidence-v1");
  assert.equal(config.suite.execution.researchProtocol.maxSearchCalls, 20);
  assert.equal(config.suite.execution.infrastructureRetries, 2);
});

test("缺少任一轨预算或配置非法搜索上限时拒绝运行", () => {
  const config = loadConfiguration();
  const missing = structuredClone(config);
  delete missing.suite.execution.budgets.LF;
  assert.equal(validateConfiguration(missing).ok, false);

  const inverted = structuredClone(config);
  inverted.suite.execution.budgets.SF.maxToolCalls = 2;
  inverted.suite.execution.budgets.SF.maxSearchCalls = 3;
  const result = validateConfiguration(inverted);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.message.includes("不能低于")));

  const invalid = structuredClone(config);
  invalid.suite.execution.budgets.LF.maxSearchCalls = 0;
  assert.equal(validateConfiguration(invalid).ok, false);

  const missingProtocol = structuredClone(config);
  delete missingProtocol.suite.execution.researchProtocol;
  assert.equal(validateConfiguration(missingProtocol).ok, false);

});

test("Judge 默认启用且允许显式关闭", () => {
  const config = loadConfiguration();
  assert.equal(buildPlan(config).judgeEnabled, true);
  assert.equal(buildPlan(config, { judge: false }).judgeEnabled, false);
});

test("任务选择器支持可审计的单题刷新并保护派生依赖", () => {
  const config = loadConfiguration();
  assert.deepEqual(selectTasks(config.suite, ["R3"]).map((task) => task.id), ["R3"]);
  assert.deepEqual(buildPlan(config, { tasks: ["R3"] }).targets[0].tasks.map((task) => task.id), ["R3"]);
  assert.throws(() => selectTasks(config.suite, ["R10"]), /需要同时选择来源题 R6/u);
  assert.throws(() => selectTasks(config.suite, ["R99"]), /题集中不存在/u);
});
