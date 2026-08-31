import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPlan, comparisonKey, selectTargets, validateConfiguration } from "./config.mjs";
import { cancelAndDrain, createHost, ensureWorkspace, startHost, stopHost, turn, waitReady } from "./host.mjs";
import { EVAL_ROOT, createRunId, isoNow, redactSecrets, safeError, sha256, writeJson } from "./lib.mjs";
import { applyUrlChecks, foldHistory } from "./observe.mjs";
import { installTarget, preflightTarget } from "./plugin.mjs";
import { baseDshHome, credentialValue, ensureProfile, ensureSearchEvalPreset, ensureTaskWorkspace, prepareTargetHome } from "./profile.mjs";
import { comparable, comparePaired, scoreTask } from "./score.mjs";
import { checkUrls } from "./url-check.mjs";
import { runJudge } from "./judge.mjs";

const EXECUTION_CONFIRMATION = "I_UNDERSTAND_THIS_STARTS_DSH_SEARCH_EVAL";
const WEB_BUNDLES = ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"];

export function assertExecutionAuthorized(options = {}) {
  if (options.execute !== true || process.env.DSH_SEARCH_EVAL_EXECUTE !== EXECUTION_CONFIRMATION) {
    throw new Error("正式运行被安全锁阻止：必须同时传 --execute 并设置 DSH_SEARCH_EVAL_EXECUTE=I_UNDERSTAND_THIS_STARTS_DSH_SEARCH_EVAL");
  }
}

export function preflightExecution(config, options = {}) {
  const validation = validateConfiguration(config, { requireFormal: options.formal === true });
  const baseHome = options.baseHome ?? baseDshHome();
  const targets = selectTargets(config.catalog, options.targets ?? []);
  const rows = targets.map((target) => ({ target, admission: preflightTarget(target, { credentialHome: baseHome, env: process.env }) }));
  const judgeKey = credentialValue(baseHome, config.suite.judge.apiKeyEnv);
  const baseHomeState = inspectBaseHome(baseHome, config.catalog);
  const formalComparisonKey = comparisonKey(config, process.env, { settingsSha256: baseHomeState.settingsSha256 });
  return {
    ok: validation.ok && rows.every((row) => row.admission.ok) && Boolean(judgeKey) && baseHomeState.clean,
    validation,
    taskIntegrity: { count: config.suite.tasks.length, sha256: config.taskFileSha256, expectedSha256: config.suite.taskSource.sha256 },
    modelLabel: process.env[config.suite.admission.requiredModelLabelEnv] ?? "UNRECORDED",
    batchId: process.env[config.suite.admission.requiredBatchIdEnv] ?? "UNRECORDED",
    judge: { enabled: true, keyRef: config.suite.judge.apiKeyEnv, keyState: judgeKey ? "present" : "missing" },
    baseHome: baseHomeState,
    comparisonKey: formalComparisonKey,
    targets: rows.map(({ target, admission }) => ({ id: target.id, plugin: target.plugin, ...admission })),
  };
}

export async function runSuite(config, options = {}) {
  assertExecutionAuthorized(options);
  const batchStartedAt = Date.now();
  const formalOptions = { ...options, formal: true };
  const preflight = preflightExecution(config, formalOptions);
  if (!preflight.validation.ok) throw new Error(formatIssues(preflight.validation));
  if (!preflight.judge.keyState || preflight.judge.keyState !== "present") throw new Error(`缺少 Judge Key ${preflight.judge.keyRef}`);
  if (!preflight.baseHome.clean) throw new Error(`基础 DSH_HOME 含搜索插件残留，拒绝正式运行: ${preflight.baseHome.contamination.join(", ")}`);

  const requested = selectTargets(config.catalog, options.targets ?? []);
  const pluginRequested = requested.some((target) => target.id.startsWith("S"));
  const c0 = config.catalog.baselines.find((target) => target.id === "C0");
  const primaryTargets = pluginRequested && !requested.some((target) => target.id === "C0") ? [c0, ...requested] : requested;
  const batchId = process.env[config.suite.admission.requiredBatchIdEnv];
  const formalComparisonKey = preflight.comparisonKey;
  const schedule = bracketSchedule(
    primaryTargets,
    c0,
    config.suite.execution.baselineBrackets,
    `${config.suite.execution.conditionOrderSeed}:${batchId}`,
  );
  const outputs = [];
  for (const row of schedule) {
    outputs.push(await runTarget(config, row.target, {
      ...options,
      batchId,
      bracket: row.bracket,
      comparisonKey: formalComparisonKey,
      baseSettingsSha256: preflight.baseHome.settingsSha256,
    }));
    if (options.signal?.aborted) break;
  }
  const durationHours = (Date.now() - batchStartedAt) / 3600000;
  const interrupted = options.signal?.aborted === true;
  const baselineDrift = assessBaselineDrift(outputs, config);
  const batchComparable = !interrupted && baselineDrift.stable && durationHours <= config.suite.admission.maxBatchHours;
  const pluginCoverage = summarizePluginCoverage(outputs, config);
  const allPluginsComplete = Object.values(pluginCoverage).every((row) => row.complete);
  applyPairedComparisons(outputs, config, batchComparable, baselineDrift);
  const batchSummary = {
    batchId,
    suiteId: config.suite.id,
    comparisonKey: formalComparisonKey,
    startedAt: new Date(batchStartedAt).toISOString(),
    completedAt: isoNow(),
    durationHours,
    maxBatchHours: config.suite.admission.maxBatchHours,
    interrupted,
    baselineDrift,
    comparable: batchComparable,
    pluginCoverage,
    allPluginsComplete,
    publishable: !interrupted && batchComparable && allPluginsComplete,
    reason: interrupted ? "batch interrupted by operator" : baselineComparabilityReason(baselineDrift, durationHours, config.suite.admission.maxBatchHours),
    publicationReason: interrupted ? "batch interrupted by operator" : !allPluginsComplete ? `one or more of S1-S8 did not produce ${config.suite.tasks.length} rankable records` : !batchComparable ? "batch is not baseline-comparable" : null,
  };
  writeJson(join(EVAL_ROOT, "records", `${batchId}-batch-summary.json`), batchSummary);
  return { plan: buildPlan(config, options), preflight, schedule: schedule.map((row) => ({ id: row.target.id, bracket: row.bracket })), batchSummary, outputs };
}

export function summarizePluginCoverage(outputs, config) {
  return Object.fromEntries(config.catalog.plugins.map((target) => {
    const output = outputs.find((row) => row.meta.condition === target.id);
    const rankableCount = output?.records.filter((record) => ["PASS", "PARTIAL", "FAIL", "RETRIEVAL_FAIL"].includes(record.result?.status)).length ?? 0;
    return [target.id, {
      status: output?.meta.status ?? "MISSING",
      recordCount: output?.records.length ?? 0,
      rankableCount,
      complete: output?.meta.status === "COMPLETED"
        && output.records.length === config.suite.tasks.length
        && rankableCount === config.suite.tasks.length,
    }];
  }));
}

export function baselineComparabilityReason(drift, durationHours, maxBatchHours) {
  if (durationHours > maxBatchHours) return "batch exceeded the allowed time window";
  if (drift.stable) return null;
  const expected = drift.expectedPairCount ?? 12;
  const minimumMetricPairs = drift.thresholds?.minimumMetricPairs ?? Math.ceil(expected * 0.8);
  if (drift.pairCount !== expected) return `C0 bracket comparison unavailable: expected ${expected} paired tasks, observed ${drift.pairCount}`;
  if (drift.rankablePairCount !== expected) return `C0 bracket comparison unavailable: only ${drift.rankablePairCount}/${expected} pairs were rankable`;
  if (Object.values(drift.metricCounts ?? {}).some((count) => count < minimumMetricPairs)) return "C0 bracket comparison unavailable: insufficient metric coverage";
  return "C0 bracket drift exceeded the frozen tolerance";
}

async function runTarget(config, target, options) {
  const baseHome = options.baseHome ?? baseDshHome();
  const liveBaseState = inspectBaseHome(baseHome, config.catalog);
  if (liveBaseState.settingsSha256 !== options.baseSettingsSha256) throw new Error("基础 settings.yaml 在批次运行期间发生变化，拒绝继续");
  const conditionInstance = options.bracket ? `${target.id}-${options.bracket}` : target.id;
  const home = prepareTargetHome(baseHome, conditionInstance, {
    fresh: config.suite.execution.freshProfilePerCondition,
    credentialRefs: target.requiredCredentialRefs,
  });
  const preset = ensureSearchEvalPreset(home, config.suite.execution.agentPreset);
  const runId = createRunId(conditionInstance, options.batchId);
  const runDir = join(EVAL_ROOT, "records", runId);
  mkdirSync(runDir, { recursive: true });
  const admission = preflightTarget(target, { credentialHome: home, env: process.env });
  const meta = {
    runId,
    batchId: options.batchId,
    bracket: options.bracket ?? null,
    suiteId: config.suite.id,
    taskFileSha256: config.taskFileSha256,
    taskCount: config.suite.tasks.length,
    comparisonKey: options.comparisonKey,
    condition: target.id,
    role: target.role ?? "plugin",
    plugin: target.plugin,
    fullName: target.fullName,
    sourceLock: target.sourceLock ?? null,
    lane: config.catalog.lane,
    modelLabel: process.env[config.suite.admission.requiredModelLabelEnv],
    judgeModel: process.env[config.suite.judge.modelEnv] ?? config.suite.judge.defaultModel,
    agentPreset: { id: preset.id, sha256: preset.sha256 },
    hostIsolation: config.suite.execution.hostIsolation,
    createdAt: isoNow(),
    admission,
    status: "PREFLIGHT",
  };
  writeJson(join(runDir, "meta.json"), meta);
  if (!admission.ok) {
    meta.status = "ADMISSION_ERROR";
    meta.completedAt = isoNow();
    writeJson(join(runDir, "meta.json"), meta);
    return { runId, runDir, meta, records: [] };
  }

  const bundles = target.profileBundles ?? WEB_BUNDLES;
  const profile = ensureProfile(home, config.suite.execution.profile, bundles, target.profilePatch ?? null);
  const install = await installTarget(profile.name, target, { cwd: EVAL_ROOT, env: { DSH_HOME: home, ...process.env } });
  meta.install = { ok: install.ok, skipped: install.skipped, code: install.code, output: install.ok ? undefined : install.output };
  if (!install.ok) {
    meta.status = "INSTALL_ERROR";
    meta.completedAt = isoNow();
    writeJson(join(runDir, "meta.json"), meta);
    return { runId, runDir, meta, records: [] };
  }

  const records = [];
  try {
    meta.status = "RUNNING";
    writeJson(join(runDir, "meta.json"), meta);
    for (const task of config.suite.tasks) {
      let handle;
      let record;
      try {
        handle = startHost({ profile: profile.name, port: config.suite.execution.port, cwd: home, env: { DSH_HOME: home, ...process.env } });
        await abortable(waitReady(handle.baseUrl, { timeoutMs: 120000 }), options.signal);
        const host = createHost(handle.baseUrl, {
          promptTimeoutMs: 30000,
          cancelTimeoutMs: config.suite.execution.cancelTimeoutMs,
          historyMaxMessages: config.suite.execution.historyMaxMessages,
        });
        record = await runTask({ config, target, task, home, host, meta, attempt: 1, signal: options.signal });
      } finally {
        // Per-task process isolation is the final cleanup barrier even if session.cancel or history retrieval fails.
        await stopHost(handle).catch(() => {});
      }
      records.push(record);
      writeJson(join(runDir, recordName(record)), record);
      if (options.signal?.aborted) throw options.signal.reason ?? new Error("测评运行被操作者中止");
    }
    meta.status = records.length === config.suite.tasks.length ? "COMPLETED" : "INCOMPLETE";
  } catch (error) {
    meta.status = options.signal?.aborted ? "ABORTED" : "SYSTEM_ERROR";
    meta.error = safeError(error);
  } finally {
    meta.completedAt = isoNow();
    meta.recordCount = records.length;
    writeJson(join(runDir, "meta.json"), meta);
  }
  return { runId, runDir, meta, records };
}

export async function runTask({ config, target, task, home, host, meta, attempt, signal = null }) {
  const workspacePath = ensureTaskWorkspace(home, task.id, attempt);
  const workspaceId = await ensureWorkspace(host, workspacePath);
  const session = await host.createSession({ workspaceId, agentPreset: config.suite.execution.agentPreset });
  const sessionId = session.sessionId ?? session.id;
  const startedAt = Date.now();
  let endedAt;
  let answer = "";
  let events = [];
  let systemError = null;
  let guard = null;
  let cleanup = { requested: false, accepted: null, settled: null, cancelError: null, historyError: null, durationMs: 0 };
  try {
    // Critical fairness invariant: send the exact upstream prompt, with no prefix, suffix, or hidden evaluator wrapper.
    const response = await turn(host, sessionId, task.prompt, {
      timeoutMs: config.suite.execution.taskTimeoutMs,
      historyMaxMessages: config.suite.execution.historyMaxMessages,
      maxAgentSteps: config.suite.execution.maxAgentSteps,
      maxToolCalls: config.suite.execution.maxToolCalls,
      forbiddenToolNames: config.suite.execution.forbiddenToolNames,
      monitorPollMs: config.suite.execution.monitorPollMs,
      monitorHistoryMaxMessages: config.suite.execution.monitorHistoryMaxMessages,
      signal,
    });
    endedAt = Date.now();
    answer = redactSecrets(response.answer);
    events = response.events;
    guard = response.guard ?? null;
  } catch (error) {
    endedAt = Date.now();
    systemError = error?.code ? `${error.code}: ${safeError(error)}` : safeError(error);
    guard = error?.details ?? null;
    const drained = await cancelAndDrain(host, sessionId, {
      cancelTimeoutMs: config.suite.execution.cancelTimeoutMs,
      cancelGraceMs: config.suite.execution.cancelGraceMs,
      cleanupHistoryTimeoutMs: config.suite.execution.cleanupHistoryTimeoutMs,
      historyMaxMessages: config.suite.execution.historyMaxMessages,
    });
    events = drained.events;
    cleanup = { ...drained };
    delete cleanup.events;
  }
  endedAt ??= Date.now();
  const lifecycle = {
    sessionId,
    agentPreset: config.suite.execution.agentPreset,
    hostIsolation: config.suite.execution.hostIsolation,
    timeoutMs: config.suite.execution.taskTimeoutMs,
    maxAgentSteps: config.suite.execution.maxAgentSteps,
    maxToolCalls: config.suite.execution.maxToolCalls,
    guard,
    cleanup,
  };
  let processLedger = foldHistory(events, {
    answer,
    startedAt,
    endedAt,
    environment: environment(config, target, task, meta, attempt, lifecycle),
  });
  const gradable = !systemError && Boolean(answer.trim());
  if (gradable) {
    const checks = await checkUrls([...new Set([...processLedger.sources.retrievedUrls, ...processLedger.sources.answerUrls])], { limit: config.suite.execution.urlCheckLimit });
    processLedger = applyUrlChecks(processLedger, checks);
  }
  const judge = gradable
    ? await runJudge(
      { task, answer, processLedger, config: config.suite.judge },
      { apiKey: credentialValue(home, config.suite.judge.apiKeyEnv) },
    )
    : { ok: false, code: "SKIPPED_SYSTEM_ERROR", message: systemError ?? "没有产生回答" };
  const result = scoreTask({ task, answer, processLedger, judge, systemError, thresholds: config.suite.thresholds });
  return {
    runId: meta.runId,
    batchId: meta.batchId,
    comparisonKey: meta.comparisonKey,
    condition: target.id,
    role: target.role ?? "plugin",
    plugin: target.plugin,
    taskId: task.id,
    topic: task.topic,
    language: task.language,
    difficultyBasis: task.difficulty_basis,
    promptSha256: sha256(task.prompt),
    promptPolicy: config.suite.taskSource.promptPolicy,
    attempt,
    createdAt: isoNow(),
    answer,
    execution: lifecycle,
    processLedger,
    judge,
    result,
  };
}

function environment(config, target, task, meta, attempt, lifecycle) {
  return {
    suiteId: config.suite.id,
    taskFileSha256: config.taskFileSha256,
    batchId: meta.batchId,
    condition: target.id,
    plugin: target.plugin,
    sourceCommit: target.sourceLock?.commit ?? null,
    lane: config.catalog.lane,
    modelLabel: meta.modelLabel,
    judgeModel: meta.judgeModel,
    platform: process.platform,
    nodeVersion: process.version,
    agentPreset: lifecycle.agentPreset,
    hostIsolation: lifecycle.hostIsolation,
    taskGuard: {
      timeoutMs: lifecycle.timeoutMs,
      maxAgentSteps: lifecycle.maxAgentSteps,
      maxToolCalls: lifecycle.maxToolCalls,
    },
    taskId: task.id,
    attempt,
  };
}

function bracketSchedule(targets, c0, count, seed) {
  const withoutC0 = targets.filter((target) => target.id !== "C0");
  const hasPlugins = withoutC0.some((target) => target.id.startsWith("S"));
  if (!hasPlugins || count < 2) return targets.map((target) => ({ target, bracket: null }));
  return [{ target: c0, bracket: "start" }, ...seededShuffle(withoutC0, seed).map((target) => ({ target, bracket: null })), { target: c0, bracket: "end" }];
}

function applyPairedComparisons(outputs, config, batchComparable, baselineDrift) {
  const c0Rows = outputs.filter((output) => output.meta.condition === "C0").flatMap((output) => output.records);
  for (const output of outputs) {
    if (!output.meta.condition.startsWith("S")) continue;
    for (const record of output.records) {
      const candidates = c0Rows.filter((row) => comparable(record, row));
      const baseline = aggregateBaseline(candidates);
      record.result.pairedVsC0 = batchComparable
        ? comparePaired(record.result, baseline, config.suite.thresholds.pairedMeaningfulDelta)
        : "NOT_COMPARABLE";
      if (!batchComparable) record.result.reasons.push("批次因 C0 漂移或时间窗超限而不可比较");
      record.baseline = baseline ? { condition: "C0", brackets: candidates.length, metrics: baseline.metrics, status: baseline.status, driftStable: baselineDrift.stable } : null;
      writeJson(join(output.runDir, recordName(record)), record);
    }
  }
}

export function assessBaselineDrift(outputs, config) {
  const start = outputs.find((output) => output.meta.condition === "C0" && output.meta.bracket === "start")?.records ?? [];
  const end = outputs.find((output) => output.meta.condition === "C0" && output.meta.bracket === "end")?.records ?? [];
  const endByTask = new Map(end.map((row) => [row.taskId, row]));
  const pairs = start.map((left) => [left, endByTask.get(left.taskId)]).filter(([, right]) => right);
  const keys = ["claimSupport", "citationCorrectness", "citationCompleteness", "sourceQuality", "urlValidity", "toolSuccessRate", "structuredCompleteness"];
  const metricCounts = {};
  const meanAbsoluteDelta = Object.fromEntries(keys.map((key) => {
    const deltas = pairs
      .map(([left, right]) => [left.result.metrics[key], right.result.metrics[key]])
      .filter(([left, right]) => Number.isFinite(left) && Number.isFinite(right))
      .map(([left, right]) => Math.abs(left - right));
    metricCounts[key] = deltas.length;
    return [key, deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : null];
  }));
  const statusMismatchRate = pairs.length ? pairs.filter(([left, right]) => left.result.status !== right.result.status).length / pairs.length : null;
  const rankable = new Set(["PASS", "PARTIAL", "FAIL", "RETRIEVAL_FAIL"]);
  const rankablePairCount = pairs.filter(([left, right]) => rankable.has(left.result.status) && rankable.has(right.result.status)).length;
  const expectedPairCount = config.suite.taskSource.count;
  const minimumMetricPairs = Math.ceil(expectedPairCount * 0.8);
  const metricStable = Object.values(meanAbsoluteDelta).filter(Number.isFinite).every((value) => value <= config.suite.thresholds.baselineMaxMeanAbsoluteDrift);
  const metricCoverage = Object.values(metricCounts).every((count) => count >= minimumMetricPairs);
  const stable = pairs.length === expectedPairCount && rankablePairCount === expectedPairCount && metricCoverage && metricStable && statusMismatchRate <= config.suite.thresholds.baselineMaxStatusMismatchRate;
  return {
    stable,
    expectedPairCount,
    pairCount: pairs.length,
    rankablePairCount,
    metricCounts,
    meanAbsoluteDelta,
    statusMismatchRate,
    thresholds: {
      maxMeanAbsoluteDrift: config.suite.thresholds.baselineMaxMeanAbsoluteDrift,
      maxStatusMismatchRate: config.suite.thresholds.baselineMaxStatusMismatchRate,
      minimumMetricPairs,
    },
  };
}

export function aggregateBaseline(records) {
  if (!records.length) return null;
  const metrics = {};
  const keys = new Set(records.flatMap((row) => Object.keys(row.result.metrics ?? {})));
  for (const key of keys) {
    const values = records.map((row) => row.result.metrics[key]).filter(Number.isFinite);
    metrics[key] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }
  const rank = { RETRIEVAL_FAIL: 0, FAIL: 1, PARTIAL: 2, PASS: 3 };
  const statuses = records.map((row) => row.result.status).filter((value) => value in rank);
  const status = statuses.length ? statuses.sort((left, right) => rank[left] - rank[right])[0] : "NOT_SCORED";
  return { status, metrics };
}

function seededShuffle(values, seed) {
  const output = [...values];
  let state = Number.parseInt(sha256(seed).slice(0, 8), 16) || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  for (let index = output.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [output[index], output[next]] = [output[next], output[index]];
  }
  return output;
}

function recordName(record) {
  return `task-${record.taskId}-attempt-${record.attempt}.json`;
}

function formatIssues(validation) {
  return validation.issues.filter((row) => row.level === "error").map((row) => `${row.path}: ${row.message}`).join("; ");
}

function abortable(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error("测评运行被操作者中止"));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new Error("测评运行被操作者中止"));
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

export function loadRecordedMeta(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

export function inspectBaseHome(baseHome, catalog) {
  const settingsPath = join(baseHome, "settings.yaml");
  const raw = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : "";
  const needles = [...new Set(catalog.plugins.flatMap((target) => {
    const plugin = String(target.plugin ?? "");
    return [
      plugin,
      target.fullName,
      plugin.replace(/^dsh-/u, ""),
      plugin.replace(/-dsh$/u, ""),
    ];
  }).filter((value) => String(value).length >= 4))];
  const contamination = needles.filter((needle) => raw.toLowerCase().includes(String(needle).toLowerCase()));
  return {
    clean: contamination.length === 0,
    settingsPresent: existsSync(settingsPath),
    settingsSha256: raw ? sha256(raw) : null,
    contamination,
  };
}
