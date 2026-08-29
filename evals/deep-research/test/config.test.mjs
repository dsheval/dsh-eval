import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  DEFAULT_PRIVATE_TASKS,
  buildPlan,
  hydrateSuite,
  loadConfiguration,
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

test("正式配置必须补齐 R1-R4 私有题面、gold 和来源", () => {
  const config = loadConfiguration({ privatePath: join(process.cwd(), "fixtures", "__missing-private-tasks.json") });
  const strictBefore = validateConfiguration(config, { requireRunnable: true });
  assert.equal(strictBefore.ok, false);

  const source = readJson(config.paths.suitePath);
  const suite = hydrateSuite(source, {
    R1: { prompt: "短事实题一", gold: ["答案一"], benchmarkSource: { taskId: "source.1" } },
    R2: { prompt: "短事实题二", gold: ["答案二"], benchmarkSource: { taskId: "source.2" } },
    R3: { prompt: "短事实题三", gold: ["答案三"], benchmarkSource: { taskId: "source.3" } },
    R4: { prompt: "短事实题四", gold: ["答案四"], benchmarkSource: { taskId: "source.4" } },
  });
  const strictAfter = validateConfiguration({ ...config, suite }, { requireRunnable: true });
  assert.equal(strictAfter.ok, true, JSON.stringify(strictAfter.issues));

  const templateSuite = hydrateSuite(source, {
    R1: { prompt: "填写冻结后的题面", gold: ["填写答案"], benchmarkSource: { taskId: "source.1" } },
    R2: { prompt: "TODO", gold: ["TBD"], benchmarkSource: { taskId: "source.2" } },
    R3: { prompt: "待补题面", gold: ["答案三"], benchmarkSource: { taskId: "source.3" } },
    R4: { prompt: "占位题面", gold: ["答案四"], benchmarkSource: { taskId: "source.4" } },
  });
  const templateResult = validateConfiguration({ ...config, suite: templateSuite }, { requireRunnable: true });
  assert.equal(templateResult.ok, false);
  assert.ok(templateResult.issues.some((issue) => issue.message.includes("占位符")));
});

test("本机冻结的十项题集可正式预检", { skip: !existsSync(DEFAULT_PRIVATE_TASKS) }, () => {
  const config = loadConfiguration();
  const result = validateConfiguration(config, { requireRunnable: true });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.equal(config.suite.tasks.filter((task) => task.benchmarkSource?.taskId).length, 8);
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
  assert.equal(plan.targets[0].tasks.filter((task) => task.mode === "normal").length, 8);
  assert.equal(plan.targets[0].tasks.filter((task) => task.mode === "interrupt").length, 1);
  assert.equal(plan.targets[0].tasks.filter((task) => task.mode === "derived").length, 1);
});

test("Judge 默认启用且允许显式关闭", () => {
  const config = loadConfiguration();
  assert.equal(buildPlan(config).judgeEnabled, true);
  assert.equal(buildPlan(config, { judge: false }).judgeEnabled, false);
});
