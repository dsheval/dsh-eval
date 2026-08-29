import { seedLines } from "./lib.mjs";
import { contentText, unwrapHistoryEvent } from "./host.mjs";

export function flattenEvents(events) {
  return (events ?? []).map(unwrapHistoryEvent);
}

export function historyText(events) {
  return flattenEvents(events)
    .map((event) => {
      const data = event?.data?.message ?? event?.data;
      return contentText(data?.content ?? data?.text ?? "");
    })
    .join("\n");
}

function usagePromptTokens(usage) {
  if (!usage || typeof usage !== "object") return null;
  const value = usage.promptTokens ?? usage.inputTokens;
  return typeof value === "number" ? value : null;
}

function usageFromEvent(event) {
  return (
    event?.data?.usage ??
    event?.data?.chunk?.usage ??
    (event?.type === "assistant/chunk" ? event.data : null)
  );
}

export function usageTotals(events) {
  const messages = flattenEvents(events)
    .filter((event) => event?.type === "assistant/message")
    .map(usageFromEvent)
    .filter((usage) => usage && typeof usage === "object");
  let rows = messages;
  if (rows.length === 0) {
    const fallback = flattenEvents(events).map(usageFromEvent).filter(Boolean).at(-1);
    rows = fallback ? [fallback] : [];
  }
  return rows.reduce(
    (sum, usage) => ({
      inputTokens: sum.inputTokens + (usage.inputTokens ?? usage.promptTokens ?? 0),
      cacheReadTokens: sum.cacheReadTokens + (usage.cacheReadTokens ?? 0),
      cacheWriteTokens: sum.cacheWriteTokens + (usage.cacheWriteTokens ?? 0),
      reasoningTokens: sum.reasoningTokens + (usage.reasoningTokens ?? 0),
      outputTokens: sum.outputTokens + (usage.outputTokens ?? usage.completionTokens ?? 0),
    }),
    { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, outputTokens: 0 },
  );
}

export function addUsageTotals(...values) {
  return values.filter(Boolean).reduce(
    (sum, usage) => ({
      inputTokens: sum.inputTokens + (usage.inputTokens ?? 0),
      cacheReadTokens: sum.cacheReadTokens + (usage.cacheReadTokens ?? 0),
      cacheWriteTokens: sum.cacheWriteTokens + (usage.cacheWriteTokens ?? 0),
      reasoningTokens: sum.reasoningTokens + (usage.reasoningTokens ?? 0),
      outputTokens: sum.outputTokens + (usage.outputTokens ?? 0),
    }),
    { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, outputTokens: 0 },
  );
}

export function lastPromptTokens(events) {
  let last = null;
  for (const event of flattenEvents(events)) {
    const usage =
      event?.data?.usage ??
      event?.data?.chunk?.usage ??
      (event?.type === "assistant/chunk" ? event.data : null);
    const value = usagePromptTokens(usage);
    if (value != null) last = value;
  }
  return last;
}

/** @deprecated 累加会把流式 chunk 加成十几万；新记录用 lastPromptTokens。 */
export function sumUsage(events) {
  const promptTokens = lastPromptTokens(events);
  return { promptTokens };
}

export function countTools(events) {
  return flattenEvents(events).filter((event) => event?.type === "tool/call").length;
}

export function countInjected(events) {
  return flattenEvents(events).filter((event) => {
    if (event?.type !== "user/message") return false;
    const source = event.data?.source;
    if (source == null) return false;
    const kind = typeof source === "string" ? source : source.type ?? source.kind;
    return kind && !/^(user|human|direct|user-rpc)$/i.test(String(kind));
  }).length;
}

export function countSessionReferences(events) {
  return flattenEvents(events).filter((event) => {
    if (event?.type !== "user/message") return false;
    const source = event.data?.source;
    const kind = typeof source === "string" ? source : source?.type ?? source?.kind;
    return kind === "session-reference";
  }).length;
}

export function seedFingerprints(task) {
  return seedLines(task)
    .map((line) => {
      const body = String(line)
        .replace(/^\[[^\]]+\]\s*/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (body.length < 12) return "";
      return body.length <= 28 ? body : body.slice(-28);
    })
    .filter(Boolean);
}

export function countSeedEcho(task, events) {
  const text = historyText(events);
  if (!text) return 0;
  return seedFingerprints(task).filter((fp) => text.includes(fp)).length;
}

export function countForeignEcho(task, suite, events) {
  if (!suite?.tasks) return null;
  const own = new Set(seedFingerprints(task));
  const text = historyText(events);
  if (!text) return 0;
  let hits = 0;
  for (const other of suite.tasks) {
    if (other.id === task.id) continue;
    for (const fp of seedFingerprints(other)) {
      if (!own.has(fp) && text.includes(fp)) hits += 1;
    }
  }
  return hits;
}

export function inferDump(task, events) {
  if (task?.id !== "T7") return false;
  const text = historyText(events);
  const hits = (task.noiseSeeds ?? []).filter((line) => text.includes(line.slice(0, 8))).length;
  return hits >= 8;
}

export function foldProcess(task, events, extra = {}) {
  const flat = flattenEvents(events);
  const hasEvents = flat.length > 0;
  const seedEvents = extra.seedEvents ?? [];
  const seedHasEvents = flattenEvents(seedEvents).length > 0;
  const seedToolCalls = extra.seedToolCalls ?? (seedHasEvents ? countTools(seedEvents) : 0);
  const probeToolCalls = extra.probeToolCalls ?? (hasEvents ? countTools(events) : 0);
  const seedInjectedCount =
    extra.seedInjectedCount ?? (seedHasEvents ? countInjected(seedEvents) : 0);
  const probeInjectedCount =
    extra.probeInjectedCount ?? (hasEvents ? countInjected(events) : 0);
  const fingerprints = seedFingerprints(task);
  const first = flat[0];
  const last = flat.at(-1);
  const eventSpanMs =
    first?.time != null && last?.time != null ? Math.max(0, last.time - first.time) : null;
  const dumped = extra.dumpedAllNoise ?? inferDump(task, events);
  return {
    injectedTokens: lastPromptTokens(events),
    extraModelCalls: extra.extraModelCalls ?? seedToolCalls + probeToolCalls,
    seedToolCalls,
    probeToolCalls,
    totalToolCalls: seedToolCalls + probeToolCalls,
    latencyMs: extra.latencyMs ?? eventSpanMs,
    seedLatencyMs: extra.seedLatencyMs ?? null,
    probeLatencyMs: extra.probeLatencyMs ?? extra.latencyMs ?? eventSpanMs,
    totalLatencyMs: extra.totalLatencyMs ?? null,
    seedUsage: extra.seedUsage ?? null,
    probeUsage: extra.probeUsage ?? usageTotals(events),
    totalUsage: extra.totalUsage ?? usageTotals(events),
    retrievedCount: extra.retrievedCount ?? null,
    injectedCount: hasEvents ? probeInjectedCount : extra.injectedCount ?? null,
    seedInjectedCount,
    probeInjectedCount,
    totalInjectedCount: seedInjectedCount + probeInjectedCount,
    sessionReferenceCount: hasEvents
      ? countSessionReferences(events)
      : extra.sessionReferenceCount ?? null,
    dumpedAllNoise: task?.id === "T7" ? dumped : extra.dumpedAllNoise ?? null,
    seedEchoCount: hasEvents ? countSeedEcho(task, events) : extra.seedEchoCount ?? null,
    seedCount: fingerprints.length,
    foreignEchoCount:
      extra.foreignEchoCount ??
      (hasEvents ? countForeignEcho(task, extra.suite, events) : extra.suite ? 0 : null),
  };
}

function sub(left, right) {
  return typeof left === "number" && typeof right === "number" ? left - right : null;
}

export function processDelta(plugin, baseline) {
  const delta = {
    promptTokenDelta: sub(plugin?.injectedTokens, baseline?.injectedTokens),
    toolCallDelta: sub(plugin?.extraModelCalls, baseline?.extraModelCalls),
    injectedDelta: sub(plugin?.injectedCount, baseline?.injectedCount),
    latencyDeltaMs: sub(plugin?.latencyMs, baseline?.latencyMs),
  };
  const totalLatencyDeltaMs = sub(plugin?.totalLatencyMs, baseline?.totalLatencyMs);
  const inputTokenDelta = sub(plugin?.totalUsage?.inputTokens, baseline?.totalUsage?.inputTokens);
  const outputTokenDelta = sub(plugin?.totalUsage?.outputTokens, baseline?.totalUsage?.outputTokens);
  if (totalLatencyDeltaMs != null) delta.totalLatencyDeltaMs = totalLatencyDeltaMs;
  if (inputTokenDelta != null) delta.inputTokenDelta = inputTokenDelta;
  if (outputTokenDelta != null) delta.outputTokenDelta = outputTokenDelta;
  return delta;
}

export function formatProcess(process, delta) {
  if (!process) return "";
  const bits = [];
  if (process.totalUsage) {
    const usage = process.totalUsage;
    bits.push(`in ${usage.inputTokens}`);
    if (usage.cacheReadTokens) bits.push(`cache ${usage.cacheReadTokens}`);
    if (usage.reasoningTokens) bits.push(`reason ${usage.reasoningTokens}`);
    bits.push(`out ${usage.outputTokens}`);
  } else if (process.injectedTokens != null) {
    const d = delta?.promptTokenDelta;
    const tok = `${process.injectedTokens} input tok`;
    bits.push(d != null ? `${tok} (${d >= 0 ? "+" : ""}${d})` : tok);
  }
  if (process.seedCount) bits.push(`echo ${process.seedEchoCount ?? 0}/${process.seedCount}`);
  if (process.foreignEchoCount != null && process.foreignEchoCount > 0) {
    bits.push(`foreign ${process.foreignEchoCount}`);
  }
  if (process.totalToolCalls != null) {
    bits.push(`${process.totalToolCalls} tools (${process.seedToolCalls ?? 0}+${process.probeToolCalls ?? 0})`);
  } else if (process.extraModelCalls != null) bits.push(`${process.extraModelCalls} tools`);
  if (process.totalInjectedCount != null) {
    bits.push(`${process.totalInjectedCount} inj (${process.seedInjectedCount ?? 0}+${process.probeInjectedCount ?? 0})`);
  } else if (process.injectedCount != null) bits.push(`${process.injectedCount} inj`);
  if (process.sessionReferenceCount > 0) bits.push(`${process.sessionReferenceCount} session-ref`);
  if (process.seedLatencyMs != null && process.probeLatencyMs != null) {
    bits.push(`seed ${Math.round(process.seedLatencyMs / 1000)}s`);
    bits.push(`probe ${Math.round(process.probeLatencyMs / 1000)}s`);
  }
  if (process.totalLatencyMs != null) bits.push(`total ${Math.round(process.totalLatencyMs / 1000)}s`);
  else if (process.latencyMs != null) bits.push(`${Math.round(process.latencyMs / 1000)}s`);
  if (process.dumpedAllNoise === true) bits.push("灌窗");
  return bits.join("  ");
}
