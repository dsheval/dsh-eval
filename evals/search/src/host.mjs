import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createConnection } from "node:net";
import { join } from "node:path";

export class TurnGuardError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "TurnGuardError";
    this.code = code;
    this.details = details;
  }
}

export function createHost(baseUrl, options = {}) {
  const call = (method, payload, extra = {}) => rpc(baseUrl, method, payload, { ...options, ...extra });
  return {
    baseUrl,
    listSessions: (extra = {}) => call("session.list", {}, extra),
    createSession: (payload = {}, extra = {}) => call("session.create", payload, extra),
    history: (sessionId, request = {}) => {
      const {
        beforeSeq,
        maxMessages = options.historyMaxMessages ?? 5000,
        timeoutMs,
        signal,
      } = request;
      return call(
        "session.history",
        { sessionId, ...(beforeSeq == null ? {} : { beforeSeq }), maxMessages },
        { ...(timeoutMs == null ? {} : { timeoutMs }), ...(signal == null ? {} : { signal }) },
      );
    },
    prompt: (sessionId, text, extra = {}) => call(
      "session.prompt",
      { sessionId, mode: "queue", content: [{ type: "text", text }] },
      { timeoutMs: extra.timeoutMs ?? options.promptTimeoutMs ?? 30000, ...(extra.signal ? { signal: extra.signal } : {}) },
    ),
    cancelSession: (sessionId, extra = {}) => call(
      "session.cancel",
      { sessionId },
      { timeoutMs: extra.timeoutMs ?? options.cancelTimeoutMs ?? 10000, ...(extra.signal ? { signal: extra.signal } : {}) },
    ),
    createWorkspace: (path, extra = {}) => call("workspace.create", { path }, extra),
    listWorkspaces: (extra = {}) => call("workspace.list", {}, extra),
  };
}

export async function waitIdle(host, sessionId, options = {}) {
  const deadline = options.deadline ?? Date.now() + (options.timeoutMs ?? 1_800_000);
  const pollMs = positive(options.pollMs, 750);
  const rpcTimeoutMs = positive(options.pollRpcTimeoutMs, 10000);
  const monitorPollMs = positive(options.monitorPollMs, 2500);
  const monitorHistoryMaxMessages = positive(options.monitorHistoryMaxMessages, 4);
  const guard = guardState();
  let nextMonitorAt = 0;
  let seenRunning = false;

  while (true) {
    assertBeforeDeadline(deadline, sessionId, guard);
    const list = await boundedCall(
      () => host.listSessions({ timeoutMs: boundedTimeout(deadline, rpcTimeoutMs), ...(options.signal ? { signal: options.signal } : {}) }),
      deadline,
      sessionId,
      guard,
    );
    const row = (list.items ?? list.sessions ?? []).find((item) => item.sessionId === sessionId || item.id === sessionId);
    if (!row) throw new TurnGuardError("SESSION_LOST", `研究会话从 Host 列表消失: ${sessionId}`, guardDetails(guard));
    if (row.running) seenRunning = true;

    if (row.running && Date.now() >= nextMonitorAt) {
      const page = await boundedCall(
        () => host.history(sessionId, {
          maxMessages: monitorHistoryMaxMessages,
          timeoutMs: boundedTimeout(deadline, rpcTimeoutMs),
          ...(options.signal ? { signal: options.signal } : {}),
        }),
        deadline,
        sessionId,
        guard,
      );
      observeGuard(guard, page.events ?? []);
      enforceGuard(guard, options);
      nextMonitorAt = Date.now() + monitorPollMs;
    }

    if (!row.running && (seenRunning || Date.now() >= (options.notRunningGraceUntil ?? 0))) {
      const page = await boundedCall(
        () => host.history(sessionId, {
          maxMessages: options.historyMaxMessages ?? 5000,
          timeoutMs: boundedTimeout(deadline, options.historyTimeoutMs ?? rpcTimeoutMs),
          ...(options.signal ? { signal: options.signal } : {}),
        }),
        deadline,
        sessionId,
        guard,
      );
      observeGuard(guard, page.events ?? []);
      enforceGuard(guard, options);
      if (lastAssistantText(page.events ?? [])) return { ...page, guard: guardDetails(guard) };
      if (seenRunning) {
        throw new TurnGuardError("NO_FINAL_ANSWER", `研究会话已停止但没有最终回答: ${sessionId}`, guardDetails(guard));
      }
    }

    await delay(Math.min(pollMs, Math.max(1, deadline - Date.now())));
  }
}

export async function turn(host, sessionId, prompt, options = {}) {
  const timeoutMs = positive(options.timeoutMs, 1_800_000);
  const deadline = Date.now() + timeoutMs;
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  let timer;
  let onExternalAbort;
  const operation = (async () => {
    await host.prompt(sessionId, prompt, {
      timeoutMs: Math.min(options.promptTimeoutMs ?? 30000, timeoutMs),
      signal,
    });
    const page = await waitIdle(host, sessionId, {
      ...options,
      deadline,
      signal,
      notRunningGraceUntil: Date.now() + (options.startGraceMs ?? 2500),
    });
    return { events: page.events ?? [], answer: lastAssistantText(page.events ?? []), guard: page.guard };
  })();
  const hardStop = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new TurnGuardError("TASK_TIMEOUT", `研究会话达到严格超时 ${timeoutMs}ms: ${sessionId}`, { timeoutMs });
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });
  const externalStop = options.signal
    ? new Promise((_, reject) => {
      onExternalAbort = () => {
        const error = new TurnGuardError("RUN_ABORTED", `测评运行被中止: ${sessionId}`, {});
        reject(error);
        controller.abort(error);
      };
      if (options.signal.aborted) onExternalAbort();
      else options.signal.addEventListener("abort", onExternalAbort, { once: true });
    })
    : null;
  try {
    return await Promise.race([operation, hardStop, ...(externalStop ? [externalStop] : [])]);
  } finally {
    clearTimeout(timer);
    if (onExternalAbort) options.signal.removeEventListener("abort", onExternalAbort);
  }
}

export async function cancelAndDrain(host, sessionId, options = {}) {
  const startedAt = Date.now();
  const output = {
    requested: true,
    accepted: false,
    settled: false,
    cancelError: null,
    historyError: null,
    durationMs: 0,
    events: [],
  };
  try {
    const response = await host.cancelSession(sessionId, { timeoutMs: options.cancelTimeoutMs ?? 10000 });
    output.accepted = response?.accepted === true;
  } catch (error) {
    output.cancelError = safeMessage(error);
  }

  const settleDeadline = Date.now() + positive(options.cancelGraceMs, 10000);
  while (Date.now() < settleDeadline) {
    try {
      const list = await host.listSessions({ timeoutMs: Math.min(2000, Math.max(1, settleDeadline - Date.now())) });
      const row = (list.items ?? list.sessions ?? []).find((item) => item.sessionId === sessionId || item.id === sessionId);
      if (!row || !row.running) {
        output.settled = true;
        break;
      }
    } catch {
      // The per-task Host is force-stopped by the runner even when this best-effort drain cannot observe settlement.
    }
    await delay(Math.min(250, Math.max(1, settleDeadline - Date.now())));
  }

  try {
    const page = await host.history(sessionId, {
      maxMessages: options.historyMaxMessages ?? 5000,
      timeoutMs: options.cleanupHistoryTimeoutMs ?? 20000,
    });
    output.events = page.events ?? [];
  } catch (error) {
    output.historyError = safeMessage(error);
  }
  output.durationMs = Date.now() - startedAt;
  return output;
}

function guardState() {
  return { maxStep: 0, callIds: new Set(), toolNames: new Set() };
}

function observeGuard(guard, events) {
  for (const entry of events) {
    const event = entry?.event ?? entry;
    const step = Number(event?.data?.step);
    if (Number.isFinite(step)) guard.maxStep = Math.max(guard.maxStep, step);
    if (event?.type !== "tool/call") continue;
    const callId = event?.data?.callId ?? `seq:${event?.seq}`;
    guard.callIds.add(String(callId));
    if (event?.data?.name) guard.toolNames.add(String(event.data.name));
  }
}

function enforceGuard(guard, options) {
  const maxAgentSteps = positive(options.maxAgentSteps, Number.POSITIVE_INFINITY);
  const maxToolCalls = positive(options.maxToolCalls, Number.POSITIVE_INFINITY);
  const forbidden = new Set(options.forbiddenToolNames ?? []);
  const leaked = [...guard.toolNames].filter((name) => forbidden.has(name));
  if (leaked.length) {
    throw new TurnGuardError("CAPABILITY_LEAK", `搜索测评观察到禁用工具: ${leaked.join(", ")}`, guardDetails(guard));
  }
  if (guard.maxStep > maxAgentSteps) {
    throw new TurnGuardError("STEP_BUDGET_EXCEEDED", `研究会话步骤超过上限 ${maxAgentSteps}: ${guard.maxStep}`, guardDetails(guard));
  }
  if (guard.callIds.size > maxToolCalls) {
    throw new TurnGuardError("TOOL_BUDGET_EXCEEDED", `研究会话工具调用超过上限 ${maxToolCalls}: ${guard.callIds.size}`, guardDetails(guard));
  }
}

function guardDetails(guard) {
  return {
    maxStep: guard.maxStep,
    observedToolCalls: guard.callIds.size,
    observedToolNames: [...guard.toolNames].sort(),
  };
}

async function boundedCall(factory, deadline, sessionId, guard) {
  try {
    return await factory();
  } catch (error) {
    if (Date.now() >= deadline || error?.name === "TimeoutError" && deadline - Date.now() <= 50) {
      throw new TurnGuardError("TASK_TIMEOUT", `研究会话达到严格超时: ${sessionId}`, guardDetails(guard));
    }
    throw error;
  }
}

function assertBeforeDeadline(deadline, sessionId, guard) {
  if (Date.now() >= deadline) {
    throw new TurnGuardError("TASK_TIMEOUT", `研究会话达到严格超时: ${sessionId}`, guardDetails(guard));
  }
}

function boundedTimeout(deadline, preferred) {
  return Math.max(1, Math.min(positive(preferred, 10000), deadline - Date.now()));
}

function positive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function rpc(baseUrl, method, payload = {}, options = {}) {
  const url = new URL(baseUrl);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`DSH Host API 只允许环回地址: ${baseUrl}`);
  }
  const rpcId = randomUUID();
  const response = await (options.fetch ?? fetch)(`${baseUrl.replace(/\/+$/u, "")}/api/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: url.host,
      origin: url.origin,
    },
    body: JSON.stringify({ type: "client-request", rpcId, method, payload }),
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 30000),
  });
  const json = await response.json();
  if (json?.type !== "server-response" || json.rpcId !== rpcId) throw new Error(`DSH RPC 响应无效: ${method}`);
  if (!json.result?.ok) throw new Error(json.result?.error?.message ?? `DSH RPC 失败: ${method}`);
  return json.result.value;
}

export async function waitReady(baseUrl, options = {}) {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < (options.timeoutMs ?? 90000)) {
    try {
      await rpc(baseUrl, "session.list", {}, { timeoutMs: 3000 });
      return;
    } catch (error) {
      lastError = safeMessage(error);
      await delay(500);
    }
  }
  throw new Error(`DSH 未就绪: ${lastError}`);
}

export function lastAssistantText(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]?.event ?? events[index];
    if (!/assistant.*message|message.*assistant/iu.test(String(event?.type ?? ""))) continue;
    const content = event?.data?.message?.content ?? event?.data?.content ?? event?.content ?? event?.data?.text;
    const text = contentText(content).trim();
    if (text) return text;
  }
  return "";
}

export function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (typeof part === "string" ? part : part?.type === "text" ? part.text ?? "" : "")).join("");
}

export async function ensureWorkspace(host, path) {
  const list = await host.listWorkspaces().catch(() => ({ items: [] }));
  const rows = list.items ?? list.workspaces ?? [];
  const found = rows.find((item) => samePath(item.path, path));
  if (found) return found.workspaceId ?? found.id;
  const created = await host.createWorkspace(path);
  return created.workspaceId ?? created.id;
}

export function resolveDshBin() {
  try {
    return createRequire(import.meta.url).resolve("@deepseek-ai/dsh/lib/bin.js");
  } catch {
    const candidate = process.env.APPDATA
      ? join(process.env.APPDATA, "npm", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js")
      : "";
    return candidate && existsSync(candidate) ? candidate : null;
  }
}

export function spawnDsh(args, options = {}) {
  const bin = resolveDshBin();
  const env = { ...process.env, ...options.env };
  if (bin) {
    return spawn(process.execPath, [bin, ...args], {
      cwd: options.cwd,
      env,
      stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  }
  const file = process.platform === "win32" ? "dsh.cmd" : "dsh";
  return spawn(file, args, {
    cwd: options.cwd,
    env,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    windowsHide: true,
  });
}

export function startHost(options) {
  const child = spawnDsh(["--profile", options.profile, "--port", String(options.port), "--no-open"], {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (chunk) => (output += chunk));
  child.stderr?.on("data", (chunk) => (output += chunk));
  return { child, port: options.port, profile: options.profile, baseUrl: `http://127.0.0.1:${options.port}`, output: () => output };
}

export async function stopHost(handle, options = {}) {
  if (!handle?.child?.pid) return;
  killProcess(handle.child);
  await waitPortClosed(handle.port, options.timeoutMs ?? 20000).catch(() => {});
}

export function killProcess(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
  } else {
    child.kill("SIGTERM");
  }
}

export async function waitPortClosed(port, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!(await portOpen(port))) return;
    await delay(300);
  }
  throw new Error(`端口 ${port} 未关闭`);
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function portOpen(port) {
  return await new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

function samePath(left, right) {
  return String(left ?? "").replace(/\\/gu, "/").toLowerCase() === String(right ?? "").replace(/\\/gu, "/").toLowerCase();
}
