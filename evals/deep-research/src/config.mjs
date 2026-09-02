import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { EVAL_ROOT, readJson } from "./lib.mjs";

export const DEFAULT_SUITE = join(EVAL_ROOT, "fixtures", "suite.json");
export const DEFAULT_CATALOG = join(EVAL_ROOT, "fixtures", "catalog.json");
export const DEFAULT_PRIVATE_TASKS = join(EVAL_ROOT, "fixtures", "private-tasks.local.json");

export function loadConfiguration(options = {}) {
  const suitePath = resolve(options.suitePath ?? DEFAULT_SUITE);
  const catalogPath = resolve(options.catalogPath ?? DEFAULT_CATALOG);
  const privatePath = resolve(options.privatePath ?? DEFAULT_PRIVATE_TASKS);
  const suite = readJson(suitePath);
  const catalog = readJson(catalogPath);
  const privateTasks = existsSync(privatePath) ? readJson(privatePath) : {};
  const hydratedSuite = hydrateSuite(suite, privateTasks);
  return {
    suite: hydratedSuite,
    catalog,
    paths: { suitePath, catalogPath, privatePath },
    privateTasksPresent: existsSync(privatePath),
  };
}

export function hydrateSuite(suite, privateTasks = {}) {
  const firstPass = suite.tasks.map((task) => {
    if (!task.privateRef) return structuredClone(task);
    const privateTask = privateTasks[task.privateRef];
    return {
      ...structuredClone(task),
      prompt: privateTask?.prompt ?? "",
      gold: privateTask?.gold ?? [],
      evidenceUrls: privateTask?.evidenceUrls ?? [],
      expectedBehavior: privateTask?.expectedBehavior ?? task.expectedBehavior,
      language: privateTask?.language ?? task.language,
      asOf: privateTask?.asOf ?? task.asOf,
      benchmarkSource: privateTask?.benchmarkSource ?? task.benchmarkSource,
      referenceSteps: privateTask?.referenceSteps ?? task.referenceSteps,
      privateConfigured: Boolean(privateTask),
    };
  });
  const byId = Object.fromEntries(firstPass.map((task) => [task.id, task]));
  const tasks = firstPass.map((task) => {
    const sourceId = task.reusePromptFrom ?? task.deriveFrom;
    if (!sourceId) return task;
    const source = byId[sourceId];
    if (!source) return task;
    return {
      ...task,
      prompt: task.prompt || source.prompt,
      deliverables: task.deliverables ?? source.deliverables,
      minOpenUrls: task.minOpenUrls ?? source.minOpenUrls,
      sourceTask: sourceId,
    };
  });
  return { ...structuredClone(suite), tasks };
}

export function validateConfiguration(config, options = {}) {
  const issues = [];
  validateSuite(config.suite, issues, options);
  validateCatalog(config.catalog, issues);
  return {
    ok: !issues.some((issue) => issue.level === "error"),
    issues,
  };
}

function validateSuite(suite, issues, options) {
  if (!suite?.id) add(issues, "error", "suite.id", "题集缺少 id");
  if (!Array.isArray(suite?.tasks)) {
    add(issues, "error", "suite.tasks", "题集缺少 tasks");
    return;
  }
  const expected = ["R1", "R3", "R6", "R7", "R10"];
  const ids = suite.tasks.map((task) => task.id);
  for (const id of expected) {
    if (!ids.includes(id)) add(issues, "error", `suite.tasks.${id}`, `缺少 ${id}`);
  }
  if (new Set(ids).size !== ids.length) add(issues, "error", "suite.tasks", "task id 重复");

  const normal = suite.tasks.filter((task) => task.mode === "normal");
  const interrupted = suite.tasks.filter((task) => task.mode === "interrupt");
  const derived = suite.tasks.filter((task) => task.mode === "derived");
  if (normal.length !== 4) add(issues, "error", "suite.tasks", `normal 题应为 4，实际 ${normal.length}`);
  if (interrupted.length !== 0) add(issues, "error", "suite.tasks", "四小时紧凑版不应包含中断题");
  if (derived.length !== 1) add(issues, "error", "suite.tasks", "派生题应为 1");
  const trackCounts = Object.fromEntries(["SF", "LF", "PRODUCT"].map((track) => [track, suite.tasks.filter((task) => task.track === track).length]));
  if (trackCounts.SF !== 2 || trackCounts.LF !== 2 || trackCounts.PRODUCT !== 1) {
    add(issues, "error", "suite.tasks", `题型必须保持 2:2:1，实际 ${trackCounts.SF}:${trackCounts.LF}:${trackCounts.PRODUCT}`);
  }

  for (const task of suite.tasks) {
    if (!task.title || !task.track || !task.mode) {
      add(issues, "error", `suite.tasks.${task.id}`, "缺少 title/track/mode");
    }
    if (task.mode !== "derived" && !String(task.prompt ?? "").trim()) {
      const level = options.requireRunnable ? "error" : "warning";
      add(issues, level, `suite.tasks.${task.id}.prompt`, "题面尚未配置");
    } else if (options.requireRunnable && containsPlaceholder(task.prompt)) {
      add(issues, "error", `suite.tasks.${task.id}.prompt`, "题面仍包含模板占位符");
    }
    if (task.track === "SF" && !(task.gold?.length > 0)) {
      const level = options.requireRunnable ? "error" : "warning";
      add(issues, level, `suite.tasks.${task.id}.gold`, "短事实 gold 尚未配置");
    } else if (
      options.requireRunnable &&
      task.track === "SF" &&
      task.gold.some((value) => containsPlaceholder(value))
    ) {
      add(issues, "error", `suite.tasks.${task.id}.gold`, "短事实 gold 仍包含模板占位符");
    }
    if (task.mode === "normal" && !task.benchmarkSource?.taskId) {
      const level = options.requireRunnable ? "error" : "warning";
      add(issues, level, `suite.tasks.${task.id}.benchmarkSource`, "缺少可审计的 benchmark 来源 taskId");
    }
    if (task.track === "LF" && !(task.deliverables?.length > 0)) {
      add(issues, "error", `suite.tasks.${task.id}.deliverables`, "长文缺少强制交付物");
    }
    if (task.timeoutMs != null && (!Number.isInteger(task.timeoutMs) || task.timeoutMs < 1000)) {
      add(issues, "error", `suite.tasks.${task.id}.timeoutMs`, "题级超时必须是至少 1000ms 的整数");
    }
    const sourceId = task.reusePromptFrom ?? task.deriveFrom;
    if (sourceId && !ids.includes(sourceId)) {
      add(issues, "error", `suite.tasks.${task.id}.source`, `引用了不存在的来源题 ${sourceId}`);
    }
  }
  validateBudgets(suite.execution, issues);
  if (suite.judge?.enabledByDefault !== true) {
    add(issues, "error", "suite.judge.enabledByDefault", "正式长文评测必须默认启用 Judge");
  }
  if (!suite.judge?.apiKeyEnv) add(issues, "error", "suite.judge.apiKeyEnv", "缺少 Judge Key 引用");
}

function validateBudgets(execution, issues) {
  if (execution?.taskTimeoutMs != null && (!Number.isInteger(execution.taskTimeoutMs) || execution.taskTimeoutMs < 1000)) {
    add(issues, "error", "suite.execution.taskTimeoutMs", "题级超时必须为 null 或至少 1000ms 的整数");
  }
  if (!Number.isInteger(execution?.installTimeoutMs) || execution.installTimeoutMs < 1000) {
    add(issues, "error", "suite.execution.installTimeoutMs", "安装超时必须是至少 1000ms 的整数");
  }
  if (!Number.isInteger(execution?.budgetPollIntervalMs) || execution.budgetPollIntervalMs < 1000) {
    add(issues, "error", "suite.execution.budgetPollIntervalMs", "预算轮询间隔必须是至少 1000ms 的整数");
  }
  if (!Number.isInteger(execution?.infrastructureRetries) || execution.infrastructureRetries < 0 || execution.infrastructureRetries > 5) {
    add(issues, "error", "suite.execution.infrastructureRetries", "infrastructureRetries 必须是 0–5 的整数");
  }
  if (!Number.isInteger(execution?.infrastructureRetryDelayMs) || execution.infrastructureRetryDelayMs < 0) {
    add(issues, "error", "suite.execution.infrastructureRetryDelayMs", "infrastructureRetryDelayMs 必须是非负整数");
  }
  const protocol = execution?.researchProtocol;
  if (!protocol?.id || !Array.isArray(protocol.instructions) || protocol.instructions.length < 4) {
    add(issues, "error", "suite.execution.researchProtocol", "研究协议必须包含 id 和至少四条指令");
  }
  if (!Number.isInteger(protocol?.maxSubagents) || protocol.maxSubagents < 1 || protocol.maxSubagents > 8) {
    add(issues, "error", "suite.execution.researchProtocol.maxSubagents", "maxSubagents 必须是 1–8 的整数");
  }
  if (!Number.isInteger(protocol?.sourcesPerDeliverable) || protocol.sourcesPerDeliverable < 1) {
    add(issues, "error", "suite.execution.researchProtocol.sourcesPerDeliverable", "sourcesPerDeliverable 必须是正整数");
  }
  for (const field of ["maxSearchCalls", "synthesisReserveCalls"]) {
    if (!Number.isInteger(protocol?.[field]) || protocol[field] < 1) {
      add(issues, "error", `suite.execution.researchProtocol.${field}`, `${field} 必须是正整数`);
    }
  }
  for (const track of ["SF", "LF", "PRODUCT"]) {
    const budget = execution?.budgets?.[track];
    if (!budget) {
      add(issues, "error", `suite.execution.budgets.${track}`, `缺少 ${track} 轨预算`);
      continue;
    }
    if (budget.maxSearchCalls != null && (!Number.isInteger(budget.maxSearchCalls) || budget.maxSearchCalls < 1)) {
      add(issues, "error", `suite.execution.budgets.${track}.maxSearchCalls`, "maxSearchCalls 必须为 null 或正整数");
    }
    if (budget.maxToolCalls != null && (!Number.isInteger(budget.maxToolCalls) || budget.maxToolCalls < 1)) {
      add(issues, "error", `suite.execution.budgets.${track}.maxToolCalls`, "maxToolCalls 必须为 null 或正整数");
    }
    for (const field of ["maxBudgetedCalls", "maxQueryRepeats", "noProgressMs"]) {
      if (!Number.isInteger(budget[field]) || budget[field] < 1) {
        add(issues, "error", `suite.execution.budgets.${track}.${field}`, `${field} 必须是正整数`);
      }
    }
    if (Number.isFinite(budget.maxSearchCalls) && Number.isFinite(budget.maxToolCalls) && budget.maxToolCalls < budget.maxSearchCalls) {
      add(issues, "error", `suite.execution.budgets.${track}`, "工具调用上限不能低于搜索调用上限");
    }
  }
}

function containsPlaceholder(value) {
  return /(?:填写|待补|占位|TODO|TBD)/iu.test(String(value ?? ""));
}

function validateCatalog(catalog, issues) {
  if (catalog?.baseline?.id !== "C0") add(issues, "error", "catalog.baseline", "基线必须为 C0");
  if (!Array.isArray(catalog?.plugins) || catalog.plugins.length !== 8) {
    add(issues, "error", "catalog.plugins", "插件名录必须恰好包含 P1–P8");
    return;
  }
  const expected = Array.from({ length: 8 }, (_, index) => `P${index + 1}`);
  for (const id of expected) {
    if (!catalog.plugins.some((target) => target.id === id)) {
      add(issues, "error", `catalog.plugins.${id}`, `缺少 ${id}`);
    }
  }
  for (const target of [catalog.baseline, ...catalog.plugins]) {
    if (!target?.install?.kind) add(issues, "error", `catalog.${target?.id}.install`, "缺少安装类型");
    if (target?.install?.kind === "dsh-add" && !target.install.spec) {
      add(issues, "error", `catalog.${target.id}.install.spec`, "dsh-add 缺少 spec");
    }
    if (["source-add", "source-profile"].includes(target?.install?.kind)) {
      for (const field of ["rootEnv", "relativePath", "artifact"]) {
        if (!target.install[field]) add(issues, "error", `catalog.${target.id}.install.${field}`, `源码安装缺少 ${field}`);
      }
    }
    if (!Array.isArray(target?.requiredCredentialRefs)) {
      add(issues, "error", `catalog.${target?.id}.requiredCredentialRefs`, "缺少凭证引用列表");
    }
  }
}

function add(issues, level, path, message) {
  issues.push({ level, path, message });
}

export function allTargets(catalog) {
  return [catalog.baseline, ...catalog.plugins.filter((target) => target.evaluation?.enabled !== false)];
}

export function selectTargets(catalog, selectors = []) {
  const targets = allTargets(catalog);
  if (!selectors.length) return targets;
  const wanted = selectors.flatMap((item) => String(item).split(",")).map((item) => item.trim().toLowerCase());
  const selected = targets.filter((target) =>
    wanted.some((value) =>
      [target.id, target.plugin, target.fullName].filter(Boolean).some((key) => key.toLowerCase() === value),
    ),
  );
  const missing = wanted.filter(
    (value) => !targets.some((target) => [target.id, target.plugin, target.fullName].filter(Boolean).some((key) => key.toLowerCase() === value)),
  );
  if (missing.length) {
    const excluded = catalog.plugins.filter((target) =>
      target.evaluation?.enabled === false &&
      missing.some((value) => [target.id, target.plugin, target.fullName].filter(Boolean).some((key) => key.toLowerCase() === value)),
    );
    if (excluded.length) {
      throw new Error(`目标已从本轮排除: ${excluded.map((target) => `${target.id} (${target.evaluation.reason})`).join(", ")}`);
    }
    throw new Error(`名录中不存在: ${missing.join(", ")}`);
  }
  return selected;
}

export function selectTasks(suite, selectors = []) {
  const tasks = suite.tasks ?? [];
  if (!selectors.length) return tasks;
  const wanted = selectors.flatMap((item) => String(item).split(",")).map((item) => item.trim().toUpperCase());
  const selected = tasks.filter((task) => wanted.includes(String(task.id).toUpperCase()));
  const missing = wanted.filter((value) => !tasks.some((task) => String(task.id).toUpperCase() === value));
  if (missing.length) throw new Error(`题集中不存在: ${missing.join(", ")}`);
  for (const task of selected) {
    const sourceId = task.reusePromptFrom ?? task.deriveFrom;
    if (task.mode === "derived" && sourceId && !selected.some((candidate) => candidate.id === sourceId)) {
      throw new Error(`派生题 ${task.id} 需要同时选择来源题 ${sourceId}`);
    }
  }
  return selected;
}

export function buildPlan(config, options = {}) {
  const targets = selectTargets(config.catalog, options.targets ?? []);
  const tasks = selectTasks(config.suite, options.tasks ?? []);
  const judgeEnabled = options.judge ?? config.suite.judge.enabledByDefault;
  return {
    suiteId: config.suite.id,
    catalogId: config.catalog.id,
    safe: true,
    startsDsh: false,
    callsModel: false,
    judgeEnabled: Boolean(judgeEnabled),
    targets: targets.map((target) => ({
      id: target.id,
      plugin: target.plugin,
      installKind: target.install.kind,
      platformCompatible: target.platforms.includes(process.platform),
      tasks: tasks.map((task) => ({
        id: task.id,
        mode: task.mode,
        track: task.track,
        budget: config.suite.execution.budgets?.[task.track] ?? null,
        action:
          task.mode === "derived"
            ? `derive from ${task.deriveFrom}`
            : task.mode === "interrupt"
              ? `run ${task.reusePromptFrom}, interrupt, resume`
              : "prompt once and collect",
      })),
    })),
  };
}
