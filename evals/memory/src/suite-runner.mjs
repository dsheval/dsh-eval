import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { catalogTargets, fetchRankings, loadRankings, resolveTargets } from "./catalog.mjs";
import {
  createHost,
  ensureWorkspace,
  evalBaseUrl,
  lastAssistantText,
  requestGracefulShutdown,
  startHost,
  stopHost,
  turn,
  waitPort,
  waitPortClosed,
  waitProcessExit,
  waitReady,
} from "./host.mjs";
import { getTask, scoreAnswer, seedLines } from "./lib.mjs";
import { addUsageTotals, foldProcess, formatProcess, usageTotals } from "./observe.mjs";
import { installPlugin, removeConflicts, removePlugin, wipePlugin } from "./plugin-ops.mjs";
import { openRun, recordsRoot, writeJson, writeProgress } from "./progress.mjs";
import {
  probePromptForProtocol,
  seedPromptForProtocol,
  withResolvedProtocol,
} from "./protocol.mjs";
import {
  dshHome,
  EVAL_AGENT_PRESET,
  ensureProfile,
  ensureWorkspaces,
  prepareTargetHome,
} from "./profile.mjs";
import { resetWorkspace, workspaceKeepRels } from "./workspace-reset.mjs";

const SMOKE_PROMPT = "只回一个字：好";

export function selectTasks(suite, taskIds) {
  if (!taskIds?.length) return suite.tasks;
  return taskIds.map((id) => getTask(suite, id));
}

export function planSuite({ catalog, suite, targets, tasks, profile, port }) {
  const steps = [`ensure-profile ${profile}`];
  for (const target of targets) {
    for (const name of target.conflictsWith ?? []) {
      steps.push(`${target.id} remove-conflict ${name}`);
    }
    steps.push(target.add ? `${target.id} install ${target.add}` : `${target.id} install none`);
    steps.push(`${target.id} protocol ${target.protocol?.id ?? "passive"}`);
    steps.push(`${target.id} start-host :${port}`);
    steps.push(`${target.id} smoke`);
    for (const task of tasks) {
      steps.push(`${target.id} ${task.id} reset → seed → ${task.barrier} → probe → score`);
    }
    steps.push(`${target.id} stop-host`);
    if (target.add) {
      steps.push(`${target.id} remove ${target.plugin}`);
      steps.push(
        target.wipe?.length ? `${target.id} wipe ${target.wipe.join(",")}` : `${target.id} wipe-skip`,
      );
    }
  }
  return {
    catalogId: catalog.id,
    suiteId: suite.id,
    profile,
    port,
    targets: targets.map((item) => item.id),
    plugins: targets.map((item) => item.plugin),
    tasks: tasks.map((item) => item.id),
    steps,
  };
}

export function baselineBroken(records) {
  const pick = (id) => records.find((row) => row.taskId === id)?.answerResult;
  if (pick("T1") === "成功" && pick("T8") === "成功") {
    return "C0 跨会话和重启都过了，题废了，整场停";
  }
  const surprise = ["T1", "T2", "T3", "T7", "T8"].filter((id) => pick(id) === "成功");
  if (surprise.length >= 3) {
    return `C0 不该过的题过了: ${surprise.join("、")}`;
  }
  const locomoHits = records
    .filter((row) => /^L\d+/i.test(row.taskId ?? "") && row.answerResult === "成功")
    .map((row) => row.taskId);
  if (locomoHits.length >= 8) {
    return `C0 不该过的 LoCoMo 题过了 ${locomoHits.length} 道: ${locomoHits.join("、")}`;
  }
  return null;
}

export async function prepareTargets(catalog, options = {}) {
  let rankings = options.rankings;
  if ((options.allMemory || options.rankingsPath) && !rankings) {
    rankings = options.rankingsPath
      ? loadRankings(options.rankingsPath)
      : await fetchRankings(catalog.rankingsUrl ?? "https://dsheval.ai/data");
  }
  const targets = resolveTargets(catalog, {
    plugins: options.plugins,
    allMemory: options.allMemory || Boolean(options.rankingsPath || options.rankings),
    noBaseline: options.noBaseline,
    rankings,
  });
  const requested = options.protocol ?? "matched";
  if (requested !== "matched") {
    return targets.map((target) => withResolvedProtocol(target, requested));
  }

  const baselineIndex = targets.findIndex(
    (target) => target.id === catalog.baseline.id && target.plugin === catalog.baseline.plugin,
  );
  if (baselineIndex === -1) {
    return targets.map((target) => withResolvedProtocol(target, "matched"));
  }

  const pluginTargets = targets
    .filter((_, index) => index !== baselineIndex)
    .map((target) => withResolvedProtocol(target, "matched"));
  const protocolIds = pluginTargets.length
    ? [...new Set(pluginTargets.map((target) => target.protocol.id))]
    : [withResolvedProtocol(catalog.baseline, "matched").protocol.id];
  const baselines = protocolIds.map((id) => withResolvedProtocol(catalog.baseline, id));
  return [...baselines, ...pluginTargets];
}

export async function runSuite(options) {
  const catalog = options.catalog;
  const suite = options.suite;
  if (options.rerunScored && !options.taskIds?.length) {
    throw new Error("--rerun-scored 必须配合显式 --tasks 使用");
  }
  if (options.rerunScored && options.fresh) {
    throw new Error("--fresh 与 --rerun-scored 不能同时使用");
  }
  const profile = options.profile ?? catalog.profile ?? "memory-eval";
  const port = options.port ?? catalog.port ?? 3180;
  const tasks = selectTasks(suite, options.taskIds);
  const targets = options.targets ?? (await prepareTargets(catalog, options));
  const plan = planSuite({ catalog, suite, targets, tasks, profile, port });

  if (options.dryRun) return { plan, runs: [] };

  const root = options.recordsRoot ?? recordsRoot(options.evalRoot);
  const home = options.home ?? dshHome();
  const baseUrl = options.baseUrl ?? evalBaseUrl(port);
  const runs = [];
  let handle;
  let current;

  try {
    for (const target of targets) {
      const isolationIssues = pluginIsolationIssues(target, process.env, { baseHome: home });
      const credentialsPath = target.add && isolationIssues.length === 0
        ? process.env.DSH_EVAL_CREDENTIALS_FILE
        : undefined;
      const targetRoot = prepareTargetHome(home, target.id, {
        fresh: Boolean(options.fresh),
        credentialsPath,
        copyBaseCredentials: !target.add,
      });
      const controlPort = options.controlPort ?? port + 10_000;
      const controlToken = randomUUID();
      const targetEnv = {
        ...expandTargetEnvironment(target.env, { baseHome: home, targetHome: targetRoot }),
        ...requiredTargetEnvironment(target, process.env),
        ...isolatedHomeEnvironment(targetRoot),
        DSH_HOME: targetRoot,
        DSH_EVAL_CONTROL_PORT: String(controlPort),
        DSH_EVAL_CONTROL_TOKEN: controlToken,
      };
      const profileInfo = ensureProfile({ home: targetRoot, name: profile });
      const workspaces = ensureWorkspaces(join(targetRoot, "memory-eval-workspaces"));
      const wipeCtx = {
        home: targetRoot,
        profileDir: profileInfo.dir,
        workspaceA: workspaces.a,
        workspaceB: workspaces.b,
      };
      const opened = openRun({
        recordsRoot: root,
        day: options.day,
        target,
        suite,
        catalog,
        profile,
        tester: options.tester ?? "",
        tasks,
        fresh: Boolean(options.fresh),
        rerunScored: Boolean(options.rerunScored),
      });
      opened.meta.dshHome = targetRoot;
      current = opened;
      mark(opened, "open", options.fresh ? "新开一轮" : `续跑，待测 ${opened.pending.map((item) => item.id).join(",") || "无"}`);

      if (opened.pending.length === 0) {
        runs.push(openedToRun(opened, target));
        mark(opened, "done", `${target.id} 没有待测题`, { status: "done" });
        continue;
      }

      if (!options.noHost) {
        stopHost(handle);
        handle = undefined;
      }

      const boot = async () => {
        if (options.noHost) {
          await waitReady(baseUrl);
          return options.host ?? createHost(baseUrl);
        }
        stopHost(handle);
        await waitPortClosed(port);
        handle = startHost({
          profile,
          port,
          cwd: workspaces.base,
          env: targetEnv,
          patchFiles: [profileInfo.lifecyclePatchPath, ...(target.protocol?.patches ?? [])],
        });
        mark(opened, "start-host", `启动 ${profile} :${port} (${target.id} 独立 DSH_HOME)`);
        try {
          await waitPort(port);
          await waitReady(baseUrl);
        } catch (error) {
          const log = handle.output();
          stopHost(handle);
          handle = undefined;
          throw new Error(`${error instanceof Error ? error.message : error}\n${log}`);
        }
        return createHost(baseUrl);
      };

      const stopAndWait = async () => {
        const closingHandle = handle;
        if (!closingHandle) return;
        stopHost(closingHandle);
        try {
          await waitProcessExit(closingHandle.child, 15_000);
        } finally {
          await waitPortClosed(port);
          if (handle === closingHandle) handle = undefined;
        }
      };

      const closeAndBoot = async () => {
        const closingHandle = handle;
        await requestGracefulShutdown(controlPort, controlToken);
        await waitProcessExit(closingHandle?.child);
        await waitPortClosed(port);
        handle = undefined;
        return boot();
      };

      const notes = [...isolationIssues];
      let install = target.add ? null : "成功";
      if (target.add) {
        mark(opened, "install", `安装 ${target.add}`);
        const missingEnv = (target.requiredEnv ?? []).filter((name) => !targetEnv[name] && !process.env[name]);
        if (isolationIssues.length) {
          install = "失败";
        } else if (missingEnv.length) {
          install = "失败";
          notes.push(`缺少环境变量: ${missingEnv.join(", ")}；未配置，不参与质量评分`);
        } else {
          try {
            notes.push(...(await removeConflicts(profile, target, { env: targetEnv })));
            const installed = await installPlugin(profile, target, {
              env: targetEnv,
              sourceCacheRoot: join(home, "memory-eval-tools", "sources"),
            });
            install = installed.ok ? "成功" : "失败";
            if (!installed.ok) {
              notes.push(trimOutput(installed.output) || installed.reason || "安装失败");
            }
          } catch (error) {
            install = "失败";
            notes.push(error instanceof Error ? error.message : String(error));
          }
        }
      }

      let host;
      let start = "失败";
      if (install !== "失败") {
        const started = await startTarget({
          boot,
          smoke: (candidate) =>
            smoke(
              candidate,
              target,
              (wait) => mark(opened, "smoke", `探针等待模型 ${Math.round(wait.elapsedMs / 1000)}s`),
            ),
        });
        host = started.host;
        start = started.start;
        if (started.error) {
          notes.push(`Host 启动或探针失败: ${trimOutput(started.error.message)}`);
        }
      }

      const run = await finishTarget({
        opened,
        host,
        boot,
        closeAndBoot,
        suite,
        catalog,
        target,
        tasks: opened.pending,
        profile,
        workspaces,
        wipeCtx,
        tester: options.tester ?? "",
        noHost: Boolean(options.noHost),
        stop: stopAndWait,
        install,
        start,
        notes,
      });
      runs.push(run);

      if (!options.noHost) {
        await stopAndWait();
      }

      if (target.add) {
        if (install === "成功") {
          try {
            const removed = await removePlugin(profile, target.removeName ?? target.plugin, { env: targetEnv });
            if (!removed.ok) run.notes.push(`卸载失败: ${target.plugin}`);
          } catch (error) {
            run.notes.push(`卸载失败: ${target.plugin} (${trimOutput(error instanceof Error ? error.message : error)})`);
          }
        }
        run.notes.push(...wipePlugin(target, wipeCtx).notes);
      }

      writeJson(join(opened.dir, "meta.json"), {
        ...opened.meta,
        install,
        notes: run.notes.join("；"),
      });
      mark(opened, "done", `${target.id} 结束`, { status: "done" });

      if (target.id === "C0" || target.plugin === "none") {
        const reason = baselineBroken(run.records);
        if (reason) throw new Error(reason);
      }
    }
  } catch (error) {
    if (current?.dir) {
      writeProgress(current.dir, {
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  } finally {
    if (!options.keepHost) stopHost(handle);
  }

  return { plan, runs };
}

export function expandTargetEnvironment(env = {}, ctx) {
  return Object.fromEntries(
    Object.entries(env).map(([name, value]) => [
      name,
      String(value)
        .replaceAll("{baseHome}", ctx.baseHome)
        .replaceAll("{targetHome}", ctx.targetHome),
    ]),
  );
}

export function requiredTargetEnvironment(target, source = process.env) {
  return Object.fromEntries(
    (target.requiredEnv ?? [])
      .filter((name) => source[name] != null && source[name] !== "")
      .map((name) => [name, source[name]]),
  );
}

export function isolatedHomeEnvironment(targetRoot) {
  return {
    HOME: targetRoot,
    USERPROFILE: targetRoot,
    APPDATA: join(targetRoot, ".appdata", "roaming"),
    LOCALAPPDATA: join(targetRoot, ".appdata", "local"),
    XDG_CACHE_HOME: join(targetRoot, ".cache"),
    XDG_CONFIG_HOME: join(targetRoot, ".config"),
    XDG_DATA_HOME: join(targetRoot, ".local", "share"),
  };
}

export function pluginIsolationIssues(target, source = process.env, options = {}) {
  if (!target.add) return [];
  const issues = [];
  if (source.DSH_EVAL_ISOLATED !== "1") {
    issues.push("安全拒绝：第三方插件只能在低权限容器或独立系统账户中运行；确认隔离后设置 DSH_EVAL_ISOLATED=1");
  }
  const credentialsPath = source.DSH_EVAL_CREDENTIALS_FILE;
  if (!credentialsPath) {
    issues.push("安全拒绝：第三方插件必须使用 DSH_EVAL_CREDENTIALS_FILE 指定的短期专用凭据");
  } else if (!existsSync(credentialsPath)) {
    issues.push(`安全拒绝：专用评测凭据不存在: ${credentialsPath}`);
  } else if (
    options.baseHome &&
    resolve(credentialsPath) === resolve(join(options.baseHome, ".credentials.yaml"))
  ) {
    issues.push("安全拒绝：DSH_EVAL_CREDENTIALS_FILE 不能指向日常 DSH_HOME 的凭据文件");
  }
  return issues;
}

export async function startTarget(options) {
  try {
    const host = await options.boot();
    await options.smoke(host);
    return { host, start: "成功", error: null };
  } catch (error) {
    return {
      host: undefined,
      start: "失败",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export function isRetryableHandlerFailure(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const body = typeof error?.body === "string" ? error.body : "";
  const explicitHandlerFailure = /\bhandler failure\b/i.test(`${body}\n${message}`);
  const nonJsonHttp500 = Number(error?.status) === 500 && error?.nonJson === true;
  return explicitHandlerFailure || nonJsonHttp500;
}

export async function runTaskWithHandlerFailureRetry(options) {
  try {
    return { value: await options.run(options.host), retried: false, firstError: null };
  } catch (error) {
    if (options.noHost || !isRetryableHandlerFailure(error)) throw error;
    options.onRetry?.(error);
    await options.stop();
    await options.wipe();
    await options.resetSessionStore();
    const host = await options.boot();
    return {
      value: await options.run(host),
      retried: true,
      firstError: error,
    };
  }
}

async function finishTarget(ctx) {
  const { opened, target, tasks, install, start } = ctx;
  const notes = [...ctx.notes];
  const { dir, runId } = opened;
  writeJson(join(dir, "meta.json"), { ...opened.meta, install, notes: notes.join("；") });

  const records = Object.values(opened.records);
  if (install === "失败" || start === "失败" || !ctx.host) {
    for (const task of tasks) {
      const record = opened.records[task.id];
      record.install = install;
      record.start = start;
      record.notes = notes.join("；");
      record.answerResult = record.answerResult ?? "失败";
      record.answerReason = record.answerReason ?? (install === "失败" ? "装失败，不打质量分" : "启动失败");
      writeJson(join(dir, `${task.id}.json`), record);
      mark(opened, task.id, record.answerReason, { status: "failed" });
    }
    return { runId, dir, target, records: tasks.map((task) => opened.records[task.id]), notes };
  }

  let host = ctx.host;
  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
    const task = tasks[taskIndex];
    const record = opened.records[task.id];
    record.install = install;
    record.start = start;
    record.barrier = task.barrier;
    record.protocol = target.protocol?.id ?? "passive";
    mark(opened, `${task.id} seed`, `${task.id} 埋点`, { status: "running" });
    try {
      const execution = await runTaskWithHandlerFailureRetry({
        host,
        noHost: ctx.noHost,
        run: (taskHost) =>
          runTask({
            ...ctx,
            host: taskHost,
            task,
            onWait: (wait, phase) =>
              mark(opened, `${task.id} ${phase}`, `${task.id} ${phase} 等待模型 ${Math.round(wait.elapsedMs / 1000)}s`),
          }),
        stop: ctx.stop,
        wipe: () => {
          const wiped = wipePlugin(target, ctx.wipeCtx);
          notes.push(...wiped.notes);
        },
        resetSessionStore: () => resetSessionStore(ctx.wipeCtx.home),
        boot: ctx.boot,
        onRetry: () =>
          mark(
            opened,
            `${task.id} retry`,
            `${task.id} handler failure：停 Host、清插件库与会话后整题冷启动重试`,
          ),
      });
      const result = execution.value;
      host = result.host;
      record.answer = result.answer;
      record.process = result.process;
      const scored = scoreAnswer(task, result.answer, {
        ...result.process,
        allowSessionReferences: target.allowSessionReferences === true,
      });
      record.answerResult = scored.result;
      record.answerReason = scored.reason;
      const retryNote = execution.retried
        ? `基础设施 handler failure，已整题冷启动重试 1 次：${trimOutput(execution.firstError?.message ?? execution.firstError)}`
        : "";
      if (retryNote) notes.push(`${task.id} ${retryNote}`);
      const recordNotes = [result.notes, retryNote].filter(Boolean).join("；");
      if (recordNotes) record.notes = recordNotes;
    } catch (error) {
      record.answerResult = "失败";
      record.answerReason = error instanceof Error ? error.message : String(error);
    }
    writeJson(join(dir, `${task.id}.json`), record);
    mark(
      opened,
      task.id,
      `${task.id} ${record.answerResult}  ${formatProcess(record.process)}  ${record.answerReason ?? ""}`.replace(/\s+/g, " ").trim(),
    );
    if (taskIndex < tasks.length - 1 && !ctx.noHost) {
      mark(opened, `${task.id} isolate`, `${task.id} 后冷启动：清插件库与 DSH 会话，避免泄露到下一题`);
      try {
        await ctx.stop?.();
        const wiped = wipePlugin(target, ctx.wipeCtx);
        notes.push(...wiped.notes.filter((note) => !/未清干净/.test(note)));
        resetSessionStore(ctx.wipeCtx.home);
        host = await ctx.boot();
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        notes.push(`题间冷启动失败: ${trimOutput(reason)}`);
        host = undefined;
      }
    }
  }
  return { runId, dir, target, records, notes };
}

function resetSessionStore(home) {
  resetWorkspace(join(home, "sessions"), {
    marker: ".keep\n",
    markerName: ".memory-eval-reset",
  });
}

async function runTask(ctx) {
  let host = ctx.host;
  const { task, workspaces, wipeCtx, target, noHost, boot, closeAndBoot, onWait } = ctx;
  const wait = (phase) => (info) => onWait?.(info, phase);
  const keepA = workspaceKeepRels(target, workspaces.a, wipeCtx);

  mark(ctx.opened, `${task.id} reset`, `${task.id} 清工作区，避免带上题脏数据`);
  resetWorkspace(workspaces.a, { marker: "a\n" });
  resetWorkspace(workspaces.b, { marker: "b\n" });

  const ids = async () => ({
    a: await ensureWorkspace(host, workspaces.a),
    b: await ensureWorkspace(host, workspaces.b),
  });

  let { a: wsA, b: wsB } = await ids();
  const seedSession = (
    await host.createSession(sessionOptions(target, { workspaceId: wsA }))
  ).sessionId;
  const taskStarted = Date.now();
  const seedStarted = Date.now();
  let seeded;
  const seedEvents = [];
  let previousSeedHistory = [];

  if (task.id === "T7") {
      seeded = await turn(
        host,
        seedSession,
        seedPromptForProtocol(seedLines(task).join("\n"), target.protocol),
        { onWait: wait("seed") },
      );
    seedEvents.push(...(seeded.events ?? []));
  } else {
    for (const line of seedLines(task)) {
      seeded = await turn(host, seedSession, seedPromptForProtocol(line, target.protocol), {
        onWait: wait("seed"),
      });
      const history = seeded.events ?? [];
      seedEvents.push(...newHistoryEvents(previousSeedHistory, history));
      previousSeedHistory = history;
    }
  }
  const seedLatencyMs = Date.now() - seedStarted;

  if (task.barrier === "close-session") {
    if (noHost) throw new Error("--no-host 无法执行真实 close-session 屏障");
    mark(ctx.opened, `${task.id} close-session`, `${task.id} 优雅关闭 DSH，等待会话与插件持久化后冷启动`);
    host = await closeAndBoot();
    ({ a: wsA, b: wsB } = await ids());
  } else if (task.barrier === "kill-dsh") {
    if (noHost) {
      return {
        host,
        answer: "",
        process: foldProcess(task, [], { dumpedAllNoise: false, suite: ctx.suite }),
        notes: "未杀进程（--no-host），T8 未测",
      };
    }
    mark(ctx.opened, `${task.id} kill-dsh`, `${task.id} 重启 DSH`);
    host = await boot();
    ({ a: wsA, b: wsB } = await ids());
  }

  if (task.barrier === "switch-workspace") {
    mark(ctx.opened, `${task.id} barrier`, `${task.id} 换到工作区乙`);
    resetWorkspace(workspaces.b, { marker: "b\n" });
  } else {
    mark(ctx.opened, `${task.id} barrier`, `${task.id} 清掉埋点文件后新开会话追问`);
    resetWorkspace(workspaces.a, { marker: "a\n", keepRelPaths: keepA });
  }

  const probeWs = task.barrier === "switch-workspace" ? wsB : wsA;
  const probeSession = (
    await host.createSession(sessionOptions(target, { workspaceId: probeWs }))
  ).sessionId;
  const probeStarted = Date.now();
  const probeBase = target.referenceSeedSession === true
    ? `${task.probe}\n\n${sessionReferenceMention(seedSession, `seed-${task.id}`)}`
    : task.probe;
  const probe = probePromptForProtocol(probeBase, target.protocol);
  const probed = await turn(host, probeSession, probe, { onWait: wait("probe") });
  const probeLatencyMs = Date.now() - probeStarted;
  const seedUsage = usageTotals(seedEvents);
  const probeUsage = usageTotals(probed.events);
  resetWorkspace(workspaces.a, { marker: "a\n" });
  resetWorkspace(workspaces.b, { marker: "b\n" });
  return {
    host,
    answer: probed.answer || lastAssistantText(probed.events),
    process: foldProcess(task, probed.events, {
      latencyMs: Date.now() - probeStarted,
      seedLatencyMs,
      probeLatencyMs,
      totalLatencyMs: Date.now() - taskStarted,
      seedUsage,
      probeUsage,
      totalUsage: addUsageTotals(seedUsage, probeUsage),
      seedEvents,
      suite: ctx.suite,
    }),
  };
}

export function newHistoryEvents(previous = [], current = []) {
  let prefix = 0;
  while (
    prefix < previous.length &&
    prefix < current.length &&
    historyEventIdentity(previous[prefix]) === historyEventIdentity(current[prefix])
  ) {
    prefix += 1;
  }
  if (prefix === previous.length) return current.slice(prefix);

  const lastPrevious = previous.length ? historyEventIdentity(previous[previous.length - 1]) : null;
  if (lastPrevious) {
    const overlap = current.findIndex((event) => historyEventIdentity(event) === lastPrevious);
    if (overlap !== -1) return current.slice(overlap + 1);
  }
  return [...current];
}

function historyEventIdentity(item) {
  const event = item?.event ?? item;
  return String(event?.eventId ?? event?.id ?? item?.eventId ?? item?.id ?? JSON.stringify(event));
}

async function smoke(host, target, onWait) {
  const created = await host.createSession(sessionOptions(target));
  const result = await turn(host, created.sessionId, SMOKE_PROMPT, { onWait: onWait ? (info) => onWait(info) : undefined });
  if (!result.answer) {
    throw new Error("探针没有回答。先确认 memory-eval profile 已登录且模型能出字。");
  }
}

function sessionOptions(target, payload = {}) {
  return {
    ...payload,
    agentPreset: target.agentPreset ?? EVAL_AGENT_PRESET,
  };
}

function sessionReferenceMention(sessionId, label) {
  const payload = Buffer.from(JSON.stringify(sessionId), "utf8").toString("base64url");
  return `@[${label}](dsh-session:${payload})`;
}

function mark(opened, step, message, extra = {}) {
  if (!opened?.dir) return;
  return writeProgress(opened.dir, { status: extra.status ?? "running", step, message, ...extra });
}

function openedToRun(opened, target) {
  return {
    runId: opened.runId,
    dir: opened.dir,
    target,
    records: Object.values(opened.records),
    notes: [],
  };
}

function trimOutput(text) {
  return String(text ?? "")
    .trim()
    .split(/\r?\n/)
    .slice(-8)
    .join("\n");
}

export function describeCatalog(catalog) {
  return catalogTargets(catalog)
    .map((item) => `${item.id} ${item.plugin}`)
    .join(", ");
}
