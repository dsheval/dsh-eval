import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createConnection } from "node:net";
import { join } from "node:path";

export function evalBaseUrl(port) {
  return `http://127.0.0.1:${port}`;
}

export function buildRequest(method, payload = {}, rpcId = randomUUID()) {
  return {
    type: "client-request",
    rpcId,
    method,
    payload,
  };
}

export function unwrapHistoryEvent(item) {
  return item?.event ?? item;
}

export function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part?.type === "text") return part.text ?? "";
      return "";
    })
    .filter(Boolean)
    .join("");
}

export function lastAssistantText(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = unwrapHistoryEvent(events[index]);
    if (event?.type !== "assistant/message") continue;
    const message = event.data?.message ?? event.data;
    const text = contentText(message?.content ?? message?.text).trim();
    if (text) return text;
  }
  return "";
}

export function parseResponse(json, rpcId) {
  if (json?.type !== "server-response") {
    throw new Error(`不是 server-response: ${json?.type ?? typeof json}`);
  }
  if (rpcId && json.rpcId !== rpcId) {
    throw new Error(`rpcId 不一致: 发 ${rpcId} 收 ${json.rpcId}`);
  }
  if (!json.result?.ok) {
    const error = json.result?.error;
    throw new Error(error?.message ?? `RPC 失败: ${error?.code ?? "unknown"}`);
  }
  return json.result.value;
}

export class RpcHttpError extends Error {
  constructor(method, status, body, options = {}) {
    const responseBody = String(body ?? "");
    const description = responseBody || "<empty body>";
    super(
      `HTTP ${status} ${method}${options.nonJson ? " non-JSON" : ""}: ${description}`,
      options.cause ? { cause: options.cause } : undefined,
    );
    this.name = "RpcHttpError";
    this.method = method;
    this.status = status;
    this.body = responseBody;
    this.nonJson = options.nonJson === true;
  }
}

export async function rpc(baseUrl, method, payload = {}, options = {}) {
  const fetchImpl = options.fetch ?? fetch;
  const request = buildRequest(method, payload);
  const url = new URL(baseUrl);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Host API 只走环回: ${baseUrl}`);
  }
  const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/api/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: url.host,
      origin: url.origin,
    },
    body: JSON.stringify(request),
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });
  const body = await response.text();
  let json;
  try {
    json = JSON.parse(body);
  } catch (cause) {
    throw new RpcHttpError(method, response.status, body, { nonJson: true, cause });
  }
  if (!response.ok && json?.type !== "server-response") {
    throw new RpcHttpError(method, response.status, body);
  }
  return parseResponse(json, request.rpcId);
}

export function createHost(baseUrl, options = {}) {
  const call = (method, payload, extra = {}) =>
    rpc(baseUrl, method, payload, { ...options, ...extra });
  return {
    baseUrl,
    rpc: call,
    listSessions: () => call("session.list", {}),
    createSession: (payload = {}) => call("session.create", payload),
    history: (sessionId, extra = {}) =>
      call("session.history", { sessionId, maxMessages: 80, ...extra }),
    prompt: (sessionId, text) =>
      call(
        "session.prompt",
        {
          sessionId,
          mode: "queue",
          content: [{ type: "text", text }],
        },
        { timeoutMs: options.promptTimeoutMs ?? 30_000 },
      ),
    createWorkspace: (path) => call("workspace.create", { path }),
    listWorkspaces: () => call("workspace.list", {}),
  };
}

export async function requestGracefulShutdown(port, token, options = {}) {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`无效评测控制端口: ${port}`);
  }
  if (!token) throw new Error("缺少评测控制令牌");
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(`http://127.0.0.1:${port}/shutdown`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      connection: "close",
    },
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 5_000),
  });
  if (response.status !== 202) {
    throw new Error(`DSH 优雅关闭被拒绝: HTTP ${response.status}`);
  }
}

export async function waitProcessExit(child, timeoutMs = 10_000) {
  if (!child || child.exitCode != null || child.signalCode != null) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`DSH 进程 ${child.pid ?? "unknown"} 未及时退出`));
    }, timeoutMs);
    const onExit = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.off("exit", onExit);
      child.off("error", onError);
    };
    child.once("exit", onExit);
    child.once("error", onError);
  });
}

export async function waitReady(baseUrl, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    try {
      await rpc(baseUrl, "session.list", {}, { timeoutMs: 3_000, fetch: options.fetch });
      return;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      await sleep(400);
    }
  }
  throw new Error(`DSH 未就绪 ${baseUrl}: ${last}`);
}

export async function waitIdle(host, sessionId, options = {}) {
  const timeoutMs = options.timeoutMs ?? (Number(process.env.DSH_EVAL_TURN_MS) || 360_000);
  const start = Date.now();
  let seenRunning = false;
  while (Date.now() - start < timeoutMs) {
    const list = await host.listSessions();
    const row = (list.items ?? []).find((item) => item.sessionId === sessionId);
    if (row?.running) seenRunning = true;
    if (seenRunning && row && !row.running) {
      const page = await host.history(sessionId);
      if (lastAssistantText(page.events ?? [])) return page;
    }
    if (!seenRunning && Date.now() - start > 2_000) {
      const page = await host.history(sessionId);
      if (lastAssistantText(page.events ?? [])) return page;
    }
    await sleep(500);
  }
  throw new Error(`会话未结束: ${sessionId}`);
}

export async function ensureWorkspace(host, path) {
  const listed = await host.listWorkspaces().catch(() => ({ items: [] }));
  const items = listed.items ?? listed.workspaces ?? [];
  const found = items.find((item) => samePath(item.path, path));
  if (found) return found.workspaceId ?? found.id;
  const created = await host.createWorkspace(path);
  return created.workspaceId ?? created.id;
}

export async function turn(host, sessionId, text, options = {}) {
  await host.prompt(sessionId, text);
  const page = await waitIdle(host, sessionId, options);
  return {
    events: page.events ?? [],
    answer: lastAssistantText(page.events ?? []),
  };
}

export function dshEnv(options = {}) {
  return { ...process.env, ...options.env };
}

export function resolveDshBin() {
  try {
    return createRequire(import.meta.url).resolve("@deepseek-ai/dsh/lib/bin.js");
  } catch {
    const candidate = process.env.APPDATA
      ? join(process.env.APPDATA, "npm/node_modules/@deepseek-ai/dsh/lib/bin.js")
      : "";
    if (candidate && existsSync(candidate)) return candidate;
    return null;
  }
}

export function spawnDsh(args, options = {}) {
  const env = dshEnv(options);
  const bin = resolveDshBin();
  if (bin) {
    const nodeArgs = options.exposeInternals
      ? ["--expose-internals", bin, ...args]
      : [bin, ...args];
    return spawn(process.execPath, nodeArgs, {
      stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
      env,
      cwd: options.cwd,
      windowsHide: true,
    });
  }
  if (options.exposeInternals) {
    throw new Error("找不到 @deepseek-ai/dsh，无法带 --expose-internals 启动");
  }
  const file = process.platform === "win32" ? "dsh.cmd" : "dsh";
  return spawn(file, args, {
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    env,
    cwd: options.cwd,
    windowsHide: true,
  });
}

export function startHost(options) {
  const port = options.port ?? 3180;
  const profile = options.profile ?? "memory-eval";
  const args = ["--profile", profile];
  for (const path of options.patchFiles ?? []) args.push("--patch", path);
  args.push("--port", String(port), "--no-open");
  const child = spawnDsh(args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
    exposeInternals: true,
  });
  let output = "";
  child.stdout?.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    output += chunk;
  });
  return {
    port,
    profile,
    baseUrl: evalBaseUrl(port),
    child,
    output: () => output,
  };
}

export function stopHost(handle) {
  if (!handle?.child) return;
  killProcess(handle.child);
}

export function killProcess(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

export async function waitPort(port, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const open = await new Promise((resolve) => {
      const socket = createConnection({ host: "127.0.0.1", port }, () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
    });
    if (open) return;
    await sleep(300);
  }
  throw new Error(`端口 ${port} 未就绪`);
}

export async function waitPortClosed(port, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const open = await new Promise((resolve) => {
      const socket = createConnection({ host: "127.0.0.1", port }, () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
    });
    if (!open) return;
    await sleep(200);
  }
  throw new Error(`端口 ${port} 未及时关闭`);
}

function samePath(left, right) {
  return String(left ?? "").replace(/\\/g, "/").toLowerCase() ===
    String(right ?? "").replace(/\\/g, "/").toLowerCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
