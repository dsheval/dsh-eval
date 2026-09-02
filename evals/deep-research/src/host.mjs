import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createConnection } from "node:net";
import { join } from "node:path";
import { countToolCalls } from "./observe.mjs";

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
    if (options.child?.exitCode != null) {
      throw new Error(`DSH Host 在就绪前退出，exitCode=${options.child.exitCode}`);
    }
    try {
      await rpc(baseUrl, "session.list", {}, { timeoutMs: 3_000, fetch: options.fetch });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await delay(500);
    }
  }
  throw new Error(`DSH 未就绪: ${lastError}`);
}

export async function waitIdle(host, sessionId, options = {}) {
  const now = options.now ?? Date.now;
  const sleep = options.delay ?? delay;
  const started = now();
  const timeoutMs = options.timeoutMs === null ? Number.POSITIVE_INFINITY : (options.timeoutMs ?? 1_800_000);
  const initialResponseGraceMs = options.initialResponseGraceMs ?? 2_500;
  const finalAnswerSettleMs = options.finalAnswerSettleMs ?? 5_000;
  const pollIntervalMs = options.pollIntervalMs ?? 750;
  const budget = options.budget ?? null;
  const budgetPollIntervalMs = budget?.pollIntervalMs ?? 15_000;
  let seenRunning = false;
  let candidateAnswer = "";
  let candidateSince = null;
  let lastProgressAt = started;
  let lastSessionMarker = null;
  let lastHistoryMarker = null;
  let nextBudgetPollAt = started;
  let relatedEvents = [];
  while (!Number.isFinite(timeoutMs) || now() - started < timeoutMs) {
    const list = await host.listSessions();
    const rows = list.items ?? list.sessions ?? [];
    const treeRows = sessionTreeRows(rows, sessionId);
    const row = treeRows.find((item) => sessionIdOf(item) === sessionId);
    const treeRunning = treeRows.some((item) => item?.running);
    const sessionMarker = sessionProgressMarker(treeRows);
    if (sessionMarker && sessionMarker !== lastSessionMarker) {
      lastSessionMarker = sessionMarker;
      lastProgressAt = now();
    }
    if (treeRunning) {
      seenRunning = true;
      candidateAnswer = "";
      candidateSince = null;
    }
    let page = null;
    if (budget && now() >= nextBudgetPollAt) {
      [page, relatedEvents] = await Promise.all([
        host.history(sessionId),
        collectSessionEvents(host, sessionId, rows),
      ]);
      const historyMarker = historyProgressMarker(relatedEvents);
      if (historyMarker && historyMarker !== lastHistoryMarker) {
        lastHistoryMarker = historyMarker;
        lastProgressAt = now();
      }
      enforceBudget(countToolCalls(relatedEvents), budget);
      nextBudgetPollAt = now() + budgetPollIntervalMs;
    }
    if (budget?.noProgressMs && now() - lastProgressAt >= budget.noProgressMs) {
      throw new EvaluationBudgetError(
        "NO_PROGRESS_TIMEOUT",
        `连续 ${budget.noProgressMs}ms 没有观察到会话进展`,
        { observed: now() - lastProgressAt, limit: budget.noProgressMs },
      );
    }
    if (
      !treeRunning &&
      ((seenRunning && row) || (!seenRunning && now() - started > initialResponseGraceMs))
    ) {
      page ??= await host.history(sessionId);
      const answer = lastAssistantText(page.events ?? []);
      if (!answer || isInterimAssistantText(answer)) {
        candidateAnswer = "";
        candidateSince = null;
      } else {
        if (answer !== candidateAnswer) {
          candidateAnswer = answer;
          candidateSince = now();
        } else if (candidateSince != null && now() - candidateSince >= finalAnswerSettleMs) {
          relatedEvents = await collectSessionEvents(host, sessionId);
          return { ...page, allEvents: relatedEvents };
        }
      }
    }
    await sleep(pollIntervalMs);
  }
  throw new EvaluationBudgetError(
    "TASK_TIME_BUDGET_EXCEEDED",
    `研究会话 ${sessionId} 达到题级时间上限 ${timeoutMs}ms`,
    { observed: now() - started, limit: timeoutMs },
  );
}

export class EvaluationBudgetError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = "EvaluationBudgetError";
    this.code = code;
    this.observed = details.observed ?? null;
    this.limit = details.limit ?? null;
  }
}

function enforceBudget(counts, budget) {
  if (Number.isFinite(budget.maxSearchCalls) && counts.searchCalls > budget.maxSearchCalls) {
    throw new EvaluationBudgetError(
      "SEARCH_BUDGET_EXCEEDED",
      `搜索调用 ${counts.searchCalls} 次，超过上限 ${budget.maxSearchCalls} 次`,
      { observed: counts.searchCalls, limit: budget.maxSearchCalls },
    );
  }
  if (Number.isFinite(budget.maxToolCalls) && counts.totalCalls > budget.maxToolCalls) {
    throw new EvaluationBudgetError(
      "TOOL_BUDGET_EXCEEDED",
      `工具调用 ${counts.totalCalls} 次，超过上限 ${budget.maxToolCalls} 次`,
      { observed: counts.totalCalls, limit: budget.maxToolCalls },
    );
  }
  if (Number.isFinite(budget.maxBudgetedCalls) && counts.budgetedCalls > budget.maxBudgetedCalls) {
    throw new EvaluationBudgetError(
      "RESEARCH_TOOL_BUDGET_EXCEEDED",
      `外部读取与计算型工具调用 ${counts.budgetedCalls} 次，超过上限 ${budget.maxBudgetedCalls} 次`,
      { observed: counts.budgetedCalls, limit: budget.maxBudgetedCalls },
    );
  }
  if (Number.isFinite(budget.maxQueryRepeats) && counts.queryStats.maxRepeat > budget.maxQueryRepeats) {
    throw new EvaluationBudgetError(
      "DUPLICATE_QUERY_BUDGET_EXCEEDED",
      `同一归一化查询最多重复 ${counts.queryStats.maxRepeat} 次，超过上限 ${budget.maxQueryRepeats} 次`,
      { observed: counts.queryStats.maxRepeat, limit: budget.maxQueryRepeats },
    );
  }
}

function sessionProgressMarker(rows) {
  return (Array.isArray(rows) ? rows : [rows])
    .filter(Boolean)
    .map((row) => {
      const updatedAt = row.updatedAt ?? row.lastUpdatedAt ?? row.modifiedAt ?? row.projections?.updatedAt ?? "";
      return `${sessionIdOf(row)}:${row.running ? "1" : "0"}:${updatedAt}`;
    })
    .sort()
    .join("|");
}

function historyProgressMarker(events) {
  if (!events?.length) return "";
  const raw = events.at(-1);
  const event = raw?.event ?? raw;
  const stamp = event?.timestamp ?? event?.createdAt ?? event?.updatedAt ?? event?.id ?? "";
  const type = event?.type ?? event?.name ?? "";
  const text = contentText(event?.data?.message?.content ?? event?.data?.content ?? event?.content ?? event?.data?.text);
  return `${events.length}:${stamp}:${type}:${text.length}:${text.slice(-80)}`;
}

export function isInterimAssistantText(text) {
  return /(?:subagents?|child agents?|background (?:agents?|jobs?)).{0,80}(?:still|remain|running|pending|working)|(?:still|remain).{0,80}(?:subagents?|child agents?|background (?:agents?|jobs?))|synthesis.{0,50}(?:pending|remain|not (?:yet )?complete)|(?:子代理|子任务|后台任务).{0,40}(?:仍|还|正在|尚未|等待|运行中)|(?:等待|待).{0,30}(?:子代理|子任务|后台任务|综合|汇总)/iu.test(
    String(text ?? ""),
  );
}

export async function turn(host, sessionId, prompt, options = {}) {
  await host.prompt(sessionId, prompt);
  const page = await waitIdle(host, sessionId, options);
  return {
    events: page.allEvents ?? page.events ?? [],
    answer: lastAssistantText(page.events ?? []),
  };
}

export async function collectSessionEvents(host, rootSessionId, providedRows = null) {
  const listed = providedRows == null ? await host.listSessions() : null;
  const rows = providedRows ?? listed?.items ?? listed?.sessions ?? [];
  const ids = sessionTreeRows(rows, rootSessionId).map(sessionIdOf).filter(Boolean);
  if (!ids.includes(rootSessionId)) ids.unshift(rootSessionId);
  const pages = await Promise.all(ids.map((id) => host.history(id).catch(() => ({ events: [] }))));
  return pages
    .flatMap((page, index) =>
      (page.events ?? []).map((entry) =>
        entry && typeof entry === "object" ? { ...entry, sessionId: ids[index] } : { event: entry, sessionId: ids[index] },
      ),
    )
    .sort(compareHistoryEntries);
}

export function sessionTreeRows(rows, rootSessionId) {
  const selected = new Set([rootSessionId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows ?? []) {
      const id = sessionIdOf(row);
      const parentId = row?.parentSessionId ?? row?.parentId ?? row?.projections?.parentSessionId;
      if (id && !selected.has(id) && parentId && selected.has(parentId)) {
        selected.add(id);
        changed = true;
      }
    }
  }
  return (rows ?? []).filter((row) => selected.has(sessionIdOf(row)));
}

function sessionIdOf(row) {
  return row?.sessionId ?? row?.id ?? "";
}

function compareHistoryEntries(left, right) {
  const a = left?.event ?? left;
  const b = right?.event ?? right;
  const aStamp = Date.parse(a?.timestamp ?? a?.createdAt ?? a?.updatedAt ?? "") || 0;
  const bStamp = Date.parse(b?.timestamp ?? b?.createdAt ?? b?.updatedAt ?? "") || 0;
  return aStamp - bStamp;
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
