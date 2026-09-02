import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { buildPlan, selectTargets, selectTasks, validateConfiguration } from "./config.mjs";
import { applyArtifactCollection, collectWorkspaceArtifacts } from "./artifacts.mjs";
import { EvaluationBudgetError, collectSessionEvents, createHost, delay, startHost, stopHost, turn, waitReady } from "./host.mjs";
import { applyUrlChecks, detectInfrastructureFailure, foldHistory } from "./observe.mjs";
import { installTarget, preflightTarget } from "./plugin.mjs";
import { baseDshHome, credentialValue, ensureProfile, ensureTaskWorkspace, prepareTargetHome } from "./profile.mjs";
import { deriveTaskRecord, compareWithBaseline, isBudgetFailure, scoreTask } from "./score.mjs";
import { checkUrls } from "./url-check.mjs";
import { runJudge } from "./judge.mjs";
import { EVAL_ROOT, createRunId, emptyProcessLedger, isoNow, safeError, writeJson } from "./lib.mjs";

const EXECUTION_CONFIRMATION = "I_UNDERSTAND_THIS_STARTS_DSH";

export function assertExecutionAuthorized(options = {}) {
  if (options.execute !== true || process.env.DSH_RESEARCH_EVAL_EXECUTE !== EXECUTION_CONFIRMATION) {
    throw new Error(
      "正式运行被安全锁阻止：必须同时传 --execute 并设置 DSH_RESEARCH_EVAL_EXECUTE=I_UNDERSTAND_THIS_STARTS_DSH",
    );
  }
}

export function preflightExecution(config, options = {}) {
  const validation = validateConfiguration(config, { requireRunnable: true });
  const targets = selectTargets(config.catalog, options.targets ?? []);
  const baseHome = options.baseHome ?? baseDshHome();
  const judgeEnabled = options.judge ?? config.suite.judge.enabledByDefault;
  const rows = targets.map((target) => preflightTarget(target, { credentialHome: baseHome, env: process.env }));
  const judgeKeyPresent = !judgeEnabled || Boolean(process.env[config.suite.judge.apiKeyEnv]) || credentialFileHas(baseHome, config.suite.judge.apiKeyEnv);
  return {
    ok: validation.ok && rows.every((row) => row.ok) && judgeKeyPresent,
    validation,
    targets: targets.map((target, index) => ({ id: target.id, plugin: target.plugin, ...rows[index] })),
    judge: {
      enabled: Boolean(judgeEnabled),
      keyRef: config.suite.judge.apiKeyEnv,
      keyState: judgeKeyPresent ? "present" : "missing",
    },
  };
}

export async function runSuite(config, options = {}) {
  assertExecutionAuthorized(options);
  const runOptions = { ...options, judge: options.judge ?? config.suite.judge.enabledByDefault };
  const preflight = preflightExecution(config, runOptions);
  if (!preflight.validation.ok) throw new Error(formatValidationErrors(preflight.validation));
  if (!preflight.ok) {
    const blocked = preflight.targets.filter((target) => !target.ok).map((target) => `${target.id}:${target.missingRequired.join(",") || target.sourceState}`);
    throw new Error(`正式运行准入失败: ${blocked.join("; ") || "unknown"}`);
  }
  if (runOptions.judge && preflight.judge.keyState !== "present") throw new Error(`缺少 Judge Key: ${preflight.judge.keyRef}`);

  const targets = selectTargets(config.catalog, runOptions.targets ?? []);
  const tasks = selectTasks(config.suite, runOptions.tasks ?? []);
  const results = [];
  for (const target of targets) {
    results.push(await runTarget(config, target, { ...runOptions, tasks }));
  }
  return { plan: buildPlan(config, runOptions), preflight, results };
}

async function runTarget(config, target, options) {
  const baseHome = options.baseHome ?? baseDshHome();
  const home = prepareTargetHome(baseHome, target.id, { fresh: options.fresh !== false });
  const runId = createRunId(`${target.id}-${target.plugin}`);
  const runDir = join(EVAL_ROOT, "records", runId);
  mkdirSync(runDir, { recursive: true });
  const admission = preflightTarget(target, { credentialHome: home, env: process.env });
  const meta = {
    runId,
    suiteId: config.suite.id,
    catalogId: config.catalog.id,
    condition: target.id,
    plugin: target.plugin,
    fullName: target.fullName,
    profile: config.catalog.profile,
    port: config.catalog.port,
    createdAt: isoNow(),
    judgeEnabled: Boolean(options.judge),
    taskSelection: options.tasks.map((task) => task.id),
    admission,
    status: "PREFLIGHT",
  };
  writeJson(join(runDir, "meta.json"), meta);
  if (!admission.ok) {
    meta.status = admission.automaticInstall ? "NOT_CONFIGURED" : "MANUAL_ADMISSION_REQUIRED";
    meta.completedAt = isoNow();
    writeJson(join(runDir, "meta.json"), meta);
    return { runId, runDir, status: meta.status, records: [] };
  }

  const profile = ensureProfile(home, config.catalog.profile);
  let install;
  try {
    install = await installTarget(profile.name, target, {
      cwd: EVAL_ROOT,
      env: targetProcessEnv(home),
      timeoutMs: config.suite.execution.installTimeoutMs,
    });
  } catch (error) {
    meta.status = "INSTALL_FAILED";
    meta.install = { ok: false, code: "INSTALL_EXCEPTION", skipped: false, output: safeError(error) };
    meta.completedAt = isoNow();
    meta.recordCount = 0;
    writeJson(join(runDir, "meta.json"), meta);
    return { runId, runDir, status: meta.status, records: [] };
  }
  meta.install = { ok: install.ok, code: install.code ?? "OK", skipped: install.skipped };
  if (!install.ok) {
    meta.status = "INSTALL_FAILED";
    meta.install.output = install.output;
    meta.completedAt = isoNow();
    writeJson(join(runDir, "meta.json"), meta);
    return { runId, runDir, status: meta.status, records: [] };
  }

  let handle;
  let host;
  const boot = async () => {
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      handle = startHost({
        profile: profile.name,
        port: config.catalog.port,
        cwd: home,
        env: { DSH_HOME: home },
      });
      try {
        await waitReady(handle.baseUrl, { timeoutMs: 120_000, child: handle.child });
        host = createHost(handle.baseUrl, { promptTimeoutMs: 30_000 });
        return { host, handle };
      } catch (error) {
        lastError = error;
        await stopHost(handle).catch(() => {});
        if (attempt < 2) await delay(1_000);
      }
    }
    throw lastError;
  };

  const records = [];
  try {
    ({ host, handle } = await boot());
    meta.status = "RUNNING";
    writeJson(join(runDir, "meta.json"), meta);
    for (const task of options.tasks) {
      if (task.mode === "derived") {
        const source = records.find((record) => record.taskId === task.deriveFrom && record.attempt === 1);
        const record = makeDerivedRecord(meta, target, task, source);
        applyBaselineUplift(record, findLatestBaselineRecord(task.id, meta.suiteId));
        records.push(record);
        writeJson(join(runDir, recordFileName(record)), record);
        continue;
      }

      const repeats =
        options.stability && config.suite.execution.stabilityTasks.includes(task.id)
          ? config.suite.execution.stabilityRepeats
          : 1;
      for (let attempt = 1; attempt <= repeats; attempt += 1) {
        let record;
        const discardedInfrastructureErrors = [];
        const maxInfrastructureAttempts = 1 + config.suite.execution.infrastructureRetries;
        for (let infrastructureAttempt = 1; infrastructureAttempt <= maxInfrastructureAttempts; infrastructureAttempt += 1) {
          record =
            task.mode === "interrupt"
              ? await runInterruptedTask({ config, target, task, attempt, meta, home, host, handle, boot })
              : await runNormalTask({ config, target, task, attempt, meta, home, host, options });
          host = record.__host ?? host;
          handle = record.__handle ?? handle;
          delete record.__host;
          delete record.__handle;
          if (!retryableInfrastructureRecord(record) || infrastructureAttempt >= maxInfrastructureAttempts) {
            record.infrastructureAttempts = infrastructureAttempt;
            record.discardedInfrastructureErrors = discardedInfrastructureErrors;
            break;
          }
          discardedInfrastructureErrors.push(record.resultLedger.reasons[0] ?? record.resultLedger.status);
          await stopHost(handle).catch(() => {});
          resetSessionStore(home);
          await delay(config.suite.execution.infrastructureRetryDelayMs);
          ({ host, handle } = await boot());
        }
        applyBaselineUplift(record, findLatestBaselineRecord(task.id, meta.suiteId));
        records.push(record);
        writeJson(join(runDir, recordFileName(record)), record);
      }

      if (task.mode !== "interrupt") {
        await stopHost(handle);
        resetSessionStore(home);
        ({ host, handle } = await boot());
      }
    }
    meta.status = "COMPLETED";
  } catch (error) {
    meta.status = "FAILED_FINAL";
    meta.error = safeError(error);
  } finally {
    await stopHost(handle).catch(() => {});
    meta.completedAt = isoNow();
    meta.recordCount = records.length;
    writeJson(join(runDir, "meta.json"), meta);
  }
  return { runId, runDir, status: meta.status, records };
}

function retryableInfrastructureRecord(record) {
  return (
    record?.resultLedger?.status === "SYSTEM_ERROR" &&
    record.resultLedger.reasons.some((reason) => /^MODEL_PROVIDER_/u.test(String(reason)))
  );
}

export function targetProcessEnv(home, env = process.env) {
  return { ...env, DSH_HOME: home };
}

export function taskSessionPayload(workspacePath) {
  return { cwd: workspacePath };
}

async function runNormalTask(ctx) {
  const { config, target, task, attempt, meta, home, host, options } = ctx;
  const workspacePath = ensureTaskWorkspace(home, task.id, attempt, { fresh: true });
  const session = await host.createSession(taskSessionPayload(workspacePath));
  const sessionId = session.sessionId ?? session.id;
  const startedAt = Date.now();
  let answer = "";
  let events = [];
  let systemError = null;
  const budget = taskBudget(config, task);
  try {
    const response = await turn(host, sessionId, taskPrompt(config, task), {
      timeoutMs: taskTimeoutMs(config, task),
      budget,
    });
    answer = response.answer;
    events = response.events;
  } catch (error) {
    systemError = safeError(error);
    events = await collectSessionEvents(host, sessionId).catch(() => []);
    systemError = detectInfrastructureFailure(events) ?? systemError;
  }
  const endedAt = Date.now();
  const artifacts = collectWorkspaceArtifacts(workspacePath);
  const scorableAnswer = `${answer}${artifacts.scoringText}`;
  let processLedger = foldHistory(events, {
    answer: scorableAnswer,
    startedAt,
    endedAt,
    environment: taskEnvironment(config, meta, target, task, attempt),
  });
  processLedger = applyArtifactCollection(processLedger, artifacts);
  processLedger.resources.budget = budgetLedger(budget, systemError);
  const scorableBudgetResult = isBudgetFailure(systemError) && scorableAnswer.trim();
  const urlChecks = systemError && !scorableBudgetResult
    ? []
    : await checkUrls(urlCheckCandidates(processLedger), {
        limit: config.suite.execution.urlCheckLimit,
      });
  processLedger = applyUrlChecks(processLedger, urlChecks);
  const judge = options.judge && task.track === "LF" && (!systemError || scorableBudgetResult) && scorableAnswer.trim()
    ? await runJudgeWithRetries(
        { task, answer: scorableAnswer, processLedger, config: config.suite.judge },
        { apiKey: credentialValue(home, config.suite.judge.apiKeyEnv) },
        config.suite.execution,
      )
    : null;
  const resultLedger = scoreTask({ task, answer: scorableAnswer, processLedger, judge, systemError });
  return baseRecord(meta, target, task, attempt, answer, processLedger, resultLedger, judge, artifacts.text);
}

async function runJudgeWithRetries(input, options, execution) {
  const maxAttempts = 1 + execution.infrastructureRetries;
  let result = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    result = await runJudge(input, options);
    if (result.ok || attempt >= maxAttempts) return result;
    await delay(execution.infrastructureRetryDelayMs);
  }
  return result;
}

async function runInterruptedTask(ctx) {
  const { config, target, task, attempt, meta, home, boot } = ctx;
  let { host, handle } = ctx;
  const workspacePath = ensureTaskWorkspace(home, task.id, attempt, { fresh: true });
  const session = await host.createSession(taskSessionPayload(workspacePath));
  const sessionId = session.sessionId ?? session.id;
  const startedAt = Date.now();
  await host.prompt(sessionId, taskPrompt(config, task));
  await delay(config.suite.execution.interruptAfterMs);
  const before = await collectSessionEvents(host, sessionId).catch(() => []);
  await stopHost(handle);
  resetSessionStore(home, { preserve: true });
  ({ host, handle } = await boot());
  let resumedSessionId = sessionId;
  let checkpointVisible = before.length > 0;
  let answer = "";
  let after = [];
  let systemError = null;
  const budget = taskBudget(config, task);
  try {
    const response = await turn(
      host,
      resumedSessionId,
      "刚才的研究进程被中断。请先说明中断前已完成到哪一步，再从已有有效进度继续；不要从头重做，也不要谎称已经完成。",
      { timeoutMs: taskTimeoutMs(config, task), budget },
    );
    answer = response.answer;
    after = response.events;
  } catch (error) {
    if (error instanceof EvaluationBudgetError) {
      systemError = safeError(error);
      after = await collectSessionEvents(host, resumedSessionId).catch(() => []);
      systemError = detectInfrastructureFailure(after) ?? systemError;
    } else {
      const fresh = await host.createSession(taskSessionPayload(workspacePath));
      resumedSessionId = fresh.sessionId ?? fresh.id;
      checkpointVisible = false;
      try {
        const response = await turn(
          host,
          resumedSessionId,
          "上一个研究会话被中断。请检查工作区中可恢复的中间产物，说明能恢复到哪一步并继续；若没有状态，明确说明无法恢复。",
          { timeoutMs: taskTimeoutMs(config, task), budget },
        );
        answer = response.answer;
        after = response.events;
      } catch (error) {
        systemError = safeError(error);
        after = await collectSessionEvents(host, resumedSessionId).catch(() => after);
        systemError = detectInfrastructureFailure(after) ?? systemError;
      }
    }
  }
  const endedAt = Date.now();
  const restartedFromBeginning = /从头|重新开始|重新检索全部/i.test(answer);
  const artifacts = collectWorkspaceArtifacts(workspacePath);
  const scorableAnswer = `${answer}${artifacts.scoringText}`;
  let processLedger = foldHistory([...before, ...after], {
    answer: scorableAnswer,
    startedAt,
    endedAt,
    environment: taskEnvironment(config, meta, target, task, attempt),
    recovery: {
      interrupted: true,
      resumed: after.length > 0,
      restartedFromBeginning,
      checkpointVisible,
    },
  });
  processLedger = applyArtifactCollection(processLedger, artifacts);
  processLedger.resources.budget = budgetLedger(budget, systemError);
  const urlChecks = systemError
    ? []
    : await checkUrls(urlCheckCandidates(processLedger), {
        limit: config.suite.execution.urlCheckLimit,
      });
  processLedger = applyUrlChecks(processLedger, urlChecks);
  const resultLedger = scoreTask({ task, answer: scorableAnswer, processLedger, systemError });
  const record = baseRecord(meta, target, task, attempt, answer, processLedger, resultLedger, null, artifacts.text);
  record.__host = host;
  record.__handle = handle;
  return record;
}

function makeDerivedRecord(meta, target, task, source) {
  const processLedger = emptyProcessLedger(environment(meta, target, task, 1));
  processLedger.environment.derivedFrom = task.deriveFrom;
  const resultLedger = deriveTaskRecord(task, source);
  return baseRecord(meta, target, task, 1, "", processLedger, resultLedger, null);
}

function taskEnvironment(config, meta, target, task, attempt) {
  const value = environment(meta, target, task, attempt);
  value.researchProtocol = task.track === "LF" ? config.suite.execution.researchProtocol?.id ?? null : null;
  return value;
}

export function taskPrompt(config, task) {
  const protocol = task.track === "LF" ? config.suite.execution.researchProtocol : null;
  if (!protocol?.instructions?.length) return task.prompt;
  const instructions = protocol.instructions.map((line) => `- ${line}`).join("\n");
  return `${task.prompt}\n\nResearch execution protocol (${protocol.id}; mandatory for this evaluation):\nLimits: at most ${protocol.maxSubagents} subagents and ${protocol.maxSearchCalls} search calls; stop at ${protocol.sourcesPerDeliverable} credible independent sources per deliverable unless they materially conflict; reserve at least ${protocol.synthesisReserveCalls} tool calls for synthesis, citation checks, and the final report.\n${instructions}`;
}

function baseRecord(meta, target, task, attempt, answer, processLedger, resultLedger, judge, artifactText = "") {
  return {
    runId: meta.runId,
    condition: target.id,
    plugin: target.plugin,
    taskId: task.id,
    title: task.title,
    track: task.track,
    mode: task.mode,
    attempt,
    createdAt: isoNow(),
    answer,
    artifactText,
    processLedger,
    resultLedger,
    judge,
  };
}

function environment(meta, target, task, attempt) {
  return {
    suiteId: meta.suiteId,
    catalogId: meta.catalogId,
    condition: target.id,
    plugin: target.plugin,
    fullName: target.fullName,
    profile: meta.profile,
    platform: process.platform,
    nodeVersion: process.version,
    model: null,
    taskId: task.id,
    attempt,
  };
}

function applyBaselineUplift(record, baseline) {
  if (record.condition === "C0") return;
  record.resultLedger.uplift = compareWithBaseline(record.resultLedger, baseline?.resultLedger);
}

function recordFileName(record) {
  return `${record.taskId}-attempt-${record.attempt}.json`;
}

function findLatestBaselineRecord(taskId, suiteId) {
  const root = join(EVAL_ROOT, "records");
  if (!existsSync(root)) return null;
  const candidates = [];
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    const metaPath = join(dir, "meta.json");
    const taskPath = join(dir, `${taskId}-attempt-1.json`);
    if (!existsSync(metaPath) || !existsSync(taskPath)) continue;
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf8"));
      if (meta.condition === "C0" && meta.suiteId === suiteId) {
        candidates.push({ createdAt: meta.createdAt, record: JSON.parse(readFileSync(taskPath, "utf8")) });
      }
    } catch {
      // Ignore incomplete run directories.
    }
  }
  candidates.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  return candidates[0]?.record ?? null;
}

function urlCheckCandidates(processLedger) {
  return [
    ...new Set([
      ...(processLedger.sources.answerUrls ?? []),
      ...(processLedger.sources.retrievedUrls ?? []),
    ]),
  ];
}

function resetSessionStore(home, options = {}) {
  if (options.preserve) return;
  const root = resolve(home);
  const sessions = resolve(home, "sessions");
  if (sessions !== root && !sessions.startsWith(root + sep)) throw new Error("sessions 路径越界");
  if (existsSync(sessions)) rmSync(sessions, { recursive: true, force: true });
  mkdirSync(sessions, { recursive: true });
}

function credentialFileHas(home, ref) {
  const path = join(home, ".credentials.yaml");
  if (!existsSync(path)) return false;
  return new RegExp(`^\\s*${ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "m").test(readFileSync(path, "utf8"));
}

function formatValidationErrors(validation) {
  return validation.issues.filter((issue) => issue.level === "error").map((issue) => `${issue.path}: ${issue.message}`).join("; ");
}

function taskTimeoutMs(config, task) {
  return task.timeoutMs ?? config.suite.execution.taskTimeoutMs;
}

function taskBudget(config, task) {
  const configured = config.suite.execution.budgets?.[task.track];
  if (!configured) return null;
  return {
    ...configured,
    pollIntervalMs: config.suite.execution.budgetPollIntervalMs,
  };
}

function budgetLedger(budget, systemError) {
  if (!budget) return null;
  const code = String(systemError ?? "").match(/^(SEARCH_BUDGET_EXCEEDED|TOOL_BUDGET_EXCEEDED|RESEARCH_TOOL_BUDGET_EXCEEDED|DUPLICATE_QUERY_BUDGET_EXCEEDED|NO_PROGRESS_TIMEOUT|TASK_TIME_BUDGET_EXCEEDED)/)?.[1] ?? null;
  return {
    maxSearchCalls: budget.maxSearchCalls,
    maxToolCalls: budget.maxToolCalls,
    maxBudgetedCalls: budget.maxBudgetedCalls,
    maxQueryRepeats: budget.maxQueryRepeats,
    noProgressMs: budget.noProgressMs,
    pollIntervalMs: budget.pollIntervalMs,
    triggered: code,
  };
}
