import assert from "node:assert/strict";
import test from "node:test";
import { buildPlan, comparisonKey, loadConfiguration, validateConfiguration } from "../src/config.mjs";

test("loads the hash-frozen upstream Hard-12 without prompt wrappers", () => {
  const config = loadConfiguration();
  const validation = validateConfiguration(config);
  assert.equal(validation.ok, true, JSON.stringify(validation.issues));
  assert.equal(config.suite.tasks.length, 12);
  assert.deepEqual(config.suite.taskSource.languageCounts, { zh: 6, en: 6 });
  assert.deepEqual(config.suite.tasks.map((task) => task.id), [39, 22, 23, 19, 9, 17, 74, 53, 91, 95, 86, 84]);
  assert.deepEqual(config.suite.tasks.map((task) => task.id), config.suite.taskSource.ids);
  assert.equal(config.taskFileSha256, config.suite.taskSource.sha256);
  assert.equal(config.suite.taskSource.promptPolicy, "verbatim-no-wrapper");
  assert.equal(config.suite.id, "dsh-search-hard12-v2");
  assert.equal(config.suite.execution.agentPreset, "search-eval");
  assert.equal(config.suite.execution.hostIsolation, "per-task");
  assert.equal(config.suite.execution.maxAgentSteps, 24);
  assert.equal(config.suite.execution.maxToolCalls, 48);
  assert.ok(config.suite.tasks.every((task) => task.difficulty_basis.source === "official DeepResearch Bench leaderboard data_gpt55"));
});

test("catalog contains C0/C1 and all eight search plugins", () => {
  const config = loadConfiguration();
  assert.deepEqual(config.catalog.baselines.map((row) => row.id), ["C0", "C1"]);
  assert.deepEqual(config.catalog.plugins.map((row) => row.id), ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]);
  assert.equal(config.catalog.baselines.find((row) => row.id === "C1").role, "diagnostic-only");
  assert.equal(buildPlan(config).targets.some((row) => row.id === "C1"), false);
});

test("plan is explicitly non-executing", () => {
  const plan = buildPlan(loadConfiguration());
  assert.equal(plan.startsDsh, false);
  assert.equal(plan.installsPlugins, false);
  assert.equal(plan.callsSearch, false);
  assert.equal(plan.callsJudge, false);
});

test("comparison key changes when execution isolation or guard settings change", () => {
  const config = loadConfiguration();
  const baseline = comparisonKey(config, {}, { settingsSha256: "settings" });
  const changed = structuredClone(config);
  changed.suite.execution.maxAgentSteps += 1;
  assert.notEqual(comparisonKey(changed, {}, { settingsSha256: "settings" }), baseline);
});

test("validation rejects configurations that can leak old sessions or coding tools", () => {
  const config = loadConfiguration();
  config.suite.execution.hostIsolation = "per-condition";
  config.suite.execution.forbiddenToolNames = [];
  const validation = validateConfiguration(config);
  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((row) => row.path === "suite.execution.hostIsolation"));
  assert.ok(validation.issues.some((row) => row.path === "suite.execution.forbiddenToolNames"));
});
