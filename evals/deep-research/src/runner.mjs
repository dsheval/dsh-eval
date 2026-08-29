import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { buildPlan, selectTargets, validateConfiguration } from "./config.mjs";
import { applyArtifactCollection, collectWorkspaceArtifacts } from "./artifacts.mjs";
import { createHost, delay, ensureWorkspace, startHost, stopHost, turn, waitReady } from "./host.mjs";
import { applyUrlChecks, foldHistory } from "./observe.mjs";
import { installTarget, preflightTarget } from "./plugin.mjs";
import { baseDshHome, credentialValue, ensureProfile, ensureTaskWorkspace, prepareTargetHome } from "./profile.mjs";
import { deriveTaskRecord, compareWithBaseline, scoreTask } from "./score.mjs";
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
  if (runOptions.judge && preflight.judge.keyState !== "present") throw new Error(`缺少 Judge Key: ${preflight.judge.keyRef}`);

  const targets = selectTargets(config.catalog, runOptions.targets ?? []);
  const results = [];
  for (const target of targets) {
    results.push(await runTarget(config, target, runOptions));
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
  const install = await installTarget(profile.name, target, {
    cwd: EVAL_ROOT,
    env: { DSH_HOME: home },
  });
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
    handle = startHost({
      profile: profile.name,
      port: config.catalog.port,
      cwd: home,
      env: { DSH_HOME: home },
    });
    await waitReady(handle.baseUrl, { timeoutMs: 120_000 });
    host = createHost(handle.baseUrl, { promptTimeoutMs: 30_000 });
    return { host, handle };
  };

  const records = [];
  try {
    ({ host, handle } = await boot());
    meta.status = "RUNNING";
    writeJson(join(runDir, "meta.json"), meta);
    for (const task of config.suite.tasks) {
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
        const record =
          task.mode === "interrupt"
            ? await runInterruptedTask({ config, target, task, attempt, meta, home, host, handle, boot })
            : await runNormalTask({ config, target, task, attempt, meta, home, host, options });
        host = record.__host ?? host;
        handle = record.__handle ?? handle;
        delete record.__host;
        delete record.__handle;
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

async function runNormalTask(ctx) {
  const { config, target, task, attempt, meta, home, host, options } = ctx;
  const workspacePath = ensureTaskWorkspace(home, task.id, attempt, { fresh: true });
  const workspaceId = await ensureWorkspace(host, workspacePath);
  const session = await host.createSession({ workspaceId });
  const sessionId = session.sessionId ?? session.id;
  const startedAt = Date.now();
  let answer = "";
  let events = [];
  let systemError = null;
  try {
    const response = await turn(host, sessionId, task.prompt, { timeoutMs: config.suite.execution.taskTimeoutMs });
    answer = response.answer;
    events = response.events;
  } catch (error) {
    systemError = safeError(error);
    events = await host.history(sessionId).then((page) => page.events ?? []).catch(() => []);
  }
  const endedAt = Date.now();
  const artifacts = collectWorkspaceArtifacts(workspacePath);
  const scorableAnswer = `${answer}${artifacts.text}`;
  let processLedger = foldHistory(events, {
    answer: scorableAnswer,
    startedAt,
    endedAt,
    environment: environment(meta, target, task, attempt),
  });
  processLedger = applyArtifactCollection(processLedger, artifacts);
  const urlChecks = await checkUrls(urlCheckCandidates(processLedger), {
    limit: config.suite.execution.urlCheckLimit,
  });
  processLedger = applyUrlChecks(processLedger, urlChecks);
  const judge = options.judge && task.track === "LF"
    ? await runJudge(
        { task, answer: scorableAnswer, processLedger, config: config.suite.judge },
        { apiKey: credentialValue(home, config.suite.judge.apiKeyEnv) },
      )
    : null;
  const resultLedger = scoreTask({ task, answer: scorableAnswer, processLedger, judge, systemError });
  return baseRecord(meta, target, task, attempt, answer, processLedger, resultLedger, judge, artifacts.text);
}

async function runInterruptedTask(ctx) {
  const { config, target, task, attempt, meta, home, boot } = ctx;
  let { host, handle } = ctx;
  const workspacePath = ensureTaskWorkspace(home, task.id, attempt, { fresh: true });
  const workspaceId = await ensureWorkspace(host, workspacePath);
  const session = await host.createSession({ workspaceId });
  const sessionId = session.sessionId ?? session.id;
  const startedAt = Date.now();
  await host.prompt(sessionId, task.prompt);
  await delay(config.suite.execution.interruptAfterMs);
  const before = await host.history(sessionId).then((page) => page.events ?? []).catch(() => []);
  await stopHost(handle);
  resetSessionStore(home, { preserve: true });
  ({ host, handle } = await boot());
  let resumedSessionId = sessionId;
  let checkpointVisible = before.length > 0;
  let answer = "";
  let after = [];
  let systemError = null;
  try {
    const response = await turn(
      host,
      resumedSessionId,
      "刚才的研究进程被中断。请先说明中断前已完成到哪一步，再从已有有效进度继续；不要从头重做，也不要谎称已经完成。",
      { timeoutMs: config.suite.execution.taskTimeoutMs },
    );
    answer = response.answer;
    after = response.events;
  } catch {
    const fresh = await host.createSession({ workspaceId: await ensureWorkspace(host, workspacePath) });
    resumedSessionId = fresh.sessionId ?? fresh.id;
    checkpointVisible = false;
    try {
      const response = await turn(
        host,
        resumedSessionId,
        "上一个研究会话被中断。请检查工作区中可恢复的中间产物，说明能恢复到哪一步并继续；若没有状态，明确说明无法恢复。",
        { timeoutMs: config.suite.execution.taskTimeoutMs },
      );
      answer = response.answer;
      after = response.events;
    } catch (error) {
      systemError = safeError(error);
    }
  }
  const endedAt = Date.now();
  const restartedFromBeginning = /从头|重新开始|重新检索全部/i.test(answer);
  const artifacts = collectWorkspaceArtifacts(workspacePath);
  const scorableAnswer = `${answer}${artifacts.text}`;
  let processLedger = foldHistory([...before, ...after], {
    answer: scorableAnswer,
    startedAt,
    endedAt,
    environment: environment(meta, target, task, attempt),
    recovery: {
      interrupted: true,
      resumed: after.length > 0,
      restartedFromBeginning,
      checkpointVisible,
    },
  });
  processLedger = applyArtifactCollection(processLedger, artifacts);
  const urlChecks = await checkUrls(urlCheckCandidates(processLedger), {
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
