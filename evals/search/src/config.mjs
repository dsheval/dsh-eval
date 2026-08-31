import { resolve } from "node:path";
import { EVAL_ROOT, readJson, readJsonl, stableHash, textFileSha256 } from "./lib.mjs";

export const DEFAULT_SUITE = resolve(EVAL_ROOT, "fixtures", "suite.json");
export const DEFAULT_CATALOG = resolve(EVAL_ROOT, "fixtures", "catalog.json");

export function loadConfiguration(options = {}) {
  const suitePath = resolve(options.suitePath ?? DEFAULT_SUITE);
  const catalogPath = resolve(options.catalogPath ?? DEFAULT_CATALOG);
  const suite = readJson(suitePath);
  const catalog = readJson(catalogPath);
  const taskPath = resolve(EVAL_ROOT, suite.taskSource.path);
  const tasks = readJsonl(taskPath);
  return {
    suite: { ...suite, tasks },
    catalog,
    paths: { suitePath, catalogPath, taskPath },
    taskFileSha256: textFileSha256(taskPath),
  };
}

export function validateConfiguration(config, options = {}) {
  const issues = [];
  const { suite, catalog } = config;
  const expectedTaskCount = suite?.taskSource?.count;
  if (!suite?.id) issue(issues, "error", "suite.id", "缺少 suite id");
  if (config.taskFileSha256 !== suite?.taskSource?.sha256) {
    issue(issues, "error", "suite.taskSource.sha256", "Hard-12 文件哈希与冻结值不一致");
  }
  if (suite?.taskSource?.hashPolicy !== "utf8-lf-normalized") {
    issue(issues, "error", "suite.taskSource.hashPolicy", "Hard-12 必须使用跨平台 UTF-8/LF 规范化哈希");
  }
  if (suite?.taskSource?.promptPolicy !== "verbatim-no-wrapper") {
    issue(issues, "error", "suite.taskSource.promptPolicy", "正式题面必须逐字发送且不得添加 wrapper");
  }
  validateExecution(suite?.execution, issues);
  if (suite?.tasks?.length !== expectedTaskCount || expectedTaskCount !== 12) {
    issue(issues, "error", "suite.tasks", `应为 12 题，实际 ${suite?.tasks?.length ?? 0}`);
  }
  const ids = suite.tasks.map((task) => task.id);
  if (JSON.stringify(ids) !== JSON.stringify(suite.taskSource.ids)) {
    issue(issues, "error", "suite.taskSource.ids", "任务 id 或顺序与冻结清单不一致");
  }
  if (new Set(ids).size !== ids.length) issue(issues, "error", "suite.tasks", "任务 id 重复");
  for (const task of suite.tasks) {
    if (!String(task.prompt ?? "").trim()) issue(issues, "error", `tasks.${task.id}.prompt`, "题面为空");
    if (!['zh', 'en'].includes(task.language)) issue(issues, "error", `tasks.${task.id}.language`, "语言必须为 zh/en");
    if (!Number.isFinite(task.difficulty_basis?.mean_race_pct)) {
      issue(issues, "error", `tasks.${task.id}.difficulty_basis`, "缺少官方难度数据");
    }
  }
  const expectedLanguages = suite?.taskSource?.languageCounts ?? {};
  if (suite.tasks.filter((task) => task.language === "zh").length !== expectedLanguages.zh || suite.tasks.filter((task) => task.language === "en").length !== expectedLanguages.en) {
    issue(issues, "error", "suite.tasks.language", `Hard-12 必须为中文 ${expectedLanguages.zh ?? "?"} 题、英文 ${expectedLanguages.en ?? "?"} 题`);
  }
  const primary = catalog?.baselines?.filter((row) => row.role === "primary-baseline") ?? [];
  if (primary.length !== 1 || primary[0].id !== "C0") issue(issues, "error", "catalog.baselines", "必须且只能有一个 C0 正式基线");
  const diagnostic = catalog?.baselines?.find((row) => row.id === "C1");
  if (!diagnostic || diagnostic.role !== "diagnostic-only") issue(issues, "error", "catalog.baselines.C1", "C1 必须标为 diagnostic-only");
  if (!Array.isArray(catalog?.plugins) || catalog.plugins.length !== 8) issue(issues, "error", "catalog.plugins", "必须恰好有 8 个搜索插件");
  const expected = Array.from({ length: 8 }, (_, index) => `S${index + 1}`);
  for (const id of expected) if (!catalog.plugins.some((row) => row.id === id)) issue(issues, "error", `catalog.plugins.${id}`, `缺少 ${id}`);
  for (const target of allTargets(catalog)) validateTarget(target, issues);
  if (suite.judge?.enabledByDefault !== true) issue(issues, "error", "suite.judge", "正式评分必须默认启用证据 Judge");
  if (options.requireFormal) {
    for (const name of [suite.admission.requiredModelLabelEnv, suite.admission.requiredBatchIdEnv]) {
      if (!process.env[name]) issue(issues, "error", `environment.${name}`, `正式运行缺少 ${name}`);
    }
  }
  return { ok: !issues.some((row) => row.level === "error"), issues };
}

function validateTarget(target, issues) {
  if (!target?.id || !target?.install?.kind) return issue(issues, "error", "catalog.target", "目标缺少 id/install.kind");
  if (!Array.isArray(target.requiredCredentialRefs)) issue(issues, "error", `catalog.${target.id}.requiredCredentialRefs`, "必须显式声明必需凭据");
  if (target.install.kind === "dsh-add" && !(target.install.specs?.length > 0)) issue(issues, "error", `catalog.${target.id}.install.specs`, "dsh-add 必须提供 specs");
  if (target.install.kind === "source-link") {
    for (const key of ["rootEnv", "relativePath", "artifact", "expectedCommit"]) {
      if (!target.install[key]) issue(issues, "error", `catalog.${target.id}.install.${key}`, `source-link 缺少 ${key}`);
    }
  }
  if (target.id.startsWith("S") && !/^[0-9a-f]{40}$/u.test(target.sourceLock?.commit ?? "")) {
    issue(issues, "error", `catalog.${target.id}.sourceLock.commit`, "插件必须冻结 40 位上游 commit");
  }
}

function validateExecution(execution, issues) {
  if (execution?.agentPreset !== "search-eval") {
    issue(issues, "error", "suite.execution.agentPreset", "正式搜索测评必须使用隔离的 search-eval preset");
  }
  if (execution?.hostIsolation !== "per-task") {
    issue(issues, "error", "suite.execution.hostIsolation", "每道题必须使用独立 Host，防止超时会话污染后续题目");
  }
  if (execution?.freshSessionPerTask !== true) {
    issue(issues, "error", "suite.execution.freshSessionPerTask", "每道题必须创建新 session");
  }
  for (const key of [
    "taskTimeoutMs",
    "maxAgentSteps",
    "maxToolCalls",
    "monitorPollMs",
    "monitorHistoryMaxMessages",
    "cancelTimeoutMs",
    "cancelGraceMs",
    "cleanupHistoryTimeoutMs",
    "historyMaxMessages",
  ]) {
    if (!Number.isInteger(execution?.[key]) || execution[key] <= 0) {
      issue(issues, "error", `suite.execution.${key}`, "必须是正整数");
    }
  }
  const forbidden = new Set(execution?.forbiddenToolNames ?? []);
  for (const name of ["skill", "pwsh", "bash"]) {
    if (!forbidden.has(name)) issue(issues, "error", "suite.execution.forbiddenToolNames", `必须阻止 ${name} 工具泄漏`);
  }
}

function issue(issues, level, path, message) {
  issues.push({ level, path, message });
}

export function allTargets(catalog) {
  return [...(catalog.baselines ?? []), ...(catalog.plugins ?? [])];
}

export function selectTargets(catalog, selectors = []) {
  const rows = allTargets(catalog);
  if (!selectors.length) return rows.filter((row) => row.defaultEnabled !== false);
  const wanted = selectors.flatMap((value) => String(value).split(",")).map((value) => value.trim().toLowerCase());
  const matches = rows.filter((row) => wanted.some((value) => [row.id, row.plugin, row.fullName].filter(Boolean).some((key) => key.toLowerCase() === value)));
  const missing = wanted.filter((value) => !rows.some((row) => [row.id, row.plugin, row.fullName].filter(Boolean).some((key) => key.toLowerCase() === value)));
  if (missing.length) throw new Error(`未知条件: ${missing.join(", ")}`);
  return matches;
}

export function buildPlan(config, options = {}) {
  const targets = selectTargets(config.catalog, options.targets ?? []);
  return {
    safe: true,
    startsDsh: false,
    installsPlugins: false,
    callsSearch: false,
    callsJudge: false,
    suiteId: config.suite.id,
    taskCount: config.suite.tasks.length,
    taskFile: config.paths.taskPath,
    taskFileSha256: config.taskFileSha256,
    promptPolicy: config.suite.taskSource.promptPolicy,
    comparisonKey: { value: comparisonKey(config), provisional: true, reason: "plan does not read the base settings hash" },
    targets: targets.map((row) => ({ id: row.id, role: row.role ?? "plugin", plugin: row.plugin, install: row.install, taskIds: config.suite.tasks.map((task) => task.id) })),
  };
}

export function comparisonKey(config, environment = process.env, extra = {}) {
  return stableHash({
    suiteId: config.suite.id,
    taskSha256: config.taskFileSha256,
    lane: config.catalog.lane,
    modelLabel: environment[config.suite.admission.requiredModelLabelEnv] ?? "UNRECORDED",
    judgeModel: environment[config.suite.judge.modelEnv] ?? config.suite.judge.defaultModel,
    settingsSha256: extra.settingsSha256 ?? "UNRECORDED",
    execution: config.suite.execution,
    thresholdVersion: config.suite.thresholds,
  });
}
