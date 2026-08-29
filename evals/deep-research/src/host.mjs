import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createConnection } from "node:net";
import { join } from "node:path";

export function evalBaseUrl(port) {
  return `http://127.0.0.1:${port}`;
}

export async function rpc(baseUrl, method, payload = {}, options = {}) {
  const url = new URL(baseUrl);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`DSH Host API 只允许环回地址: ${baseUrl}`);
  }
  const rpcId = randomUUID();
  const response = await (options.fetch ?? fetch)(`${baseUrl.replace(/\/+$/, "")}/api/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: url.host,
      origin: url.origin,
    },
    body: JSON.stringify({ type: "client-request", rpcId, method, payload }),
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });
  const json = await response.json();
  if (json?.type !== "server-response" || json.rpcId !== rpcId) throw new Error(`DSH RPC 响应无效: ${method}`);
  if (!json.result?.ok) throw new Error(json.result?.error?.message ?? `DSH RPC 失败: ${method}`);
  return json.result.value;
}

export function createHost(baseUrl, options = {}) {
  const call = (method, payload, extra = {}) => rpc(baseUrl, method, payload, { ...options, ...extra });
  return {
    baseUrl,
    listSessions: () => call("session.list", {}),
    createSession: (payload = {}) => call("session.create", payload),
    history: (sessionId) => call("session.history", { sessionId, maxMessages: 200 }),
    prompt: (sessionId, text) =>
      call(
        "session.prompt",
        { sessionId, mode: "queue", content: [{ type: "text", text }] },
        { timeoutMs: options.promptTimeoutMs ?? 30_000 },
      ),
    createWorkspace: (path) => call("workspace.create", { path }),
    listWorkspaces: () => call("workspace.list", {}),
  };
}

export async function waitReady(baseUrl, options = {}) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < (options.timeoutMs ?? 90_000)) {
    try {
      await rpc(baseUrl, "session.list", {}, { timeoutMs: 3_000 });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await delay(500);
    }
  }
  throw new Error(`DSH 未就绪: ${lastError}`);
}

export async function waitIdle(host, sessionId, options = {}) {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? 1_800_000;
  let seenRunning = false;
  while (Date.now() - started < timeoutMs) {
    const list = await host.listSessions();
    const row = (list.items ?? list.sessions ?? []).find((item) => item.sessionId === sessionId || item.id === sessionId);
    if (row?.running) seenRunning = true;
    if ((seenRunning && row && !row.running) || (!seenRunning && Date.now() - started > 2_500)) {
      const page = await host.history(sessionId);
      if (lastAssistantText(page.events ?? [])) return page;
    }
    await delay(750);
  }
  throw new Error(`研究会话超时: ${sessionId}`);
}

export async function turn(host, sessionId, prompt, options = {}) {
  await host.prompt(sessionId, prompt);
  const page = await waitIdle(host, sessionId, options);
  return { events: page.events ?? [], answer: lastAssistantText(page.events ?? []) };
}

export function lastAssistantText(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]?.event ?? events[index];
    if (!/assistant.*message|message.*assistant/i.test(String(event?.type ?? ""))) continue;
    const content = event?.data?.message?.content ?? event?.data?.content ?? event?.content ?? event?.data?.text;
    const text = contentText(content).trim();
    if (text) return text;
  }
  return "";
}

export function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (typeof part === "string" ? part : part?.type === "text" ? part.text ?? "" : ""))
    .join("");
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
  const args = ["--profile", options.profile, "--port", String(options.port), "--no-open"];
  const child = spawnDsh(args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (chunk) => (output += chunk));
  child.stderr?.on("data", (chunk) => (output += chunk));
  return { child, port: options.port, profile: options.profile, baseUrl: evalBaseUrl(options.port), output: () => output };
}

export async function stopHost(handle, options = {}) {
  if (!handle?.child?.pid) return;
  killProcess(handle.child);
  await waitPortClosed(handle.port, options.timeoutMs ?? 20_000).catch(() => {});
}

export function killProcess(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
  } else {
    child.kill("SIGTERM");
  }
}

export async function waitPortClosed(port, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await portOpen(port))) return;
    await delay(300);
  }
  throw new Error(`端口 ${port} 未关闭`);
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
  return String(left ?? "").replace(/\\/g, "/").toLowerCase() === String(right ?? "").replace(/\\/g, "/").toLowerCase();
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
