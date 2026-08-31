#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evalRoot } from "./lib.mjs";
import { PROTOCOLS } from "./protocol.mjs";

const DISPLAY_NAMES = {
  P2: "Graph Memory",
  P3: "Mnemon（官方版）",
  P4: "Memory Evolve",
  P5: "dsh-mnemon",
  P6: "dsh-noema",
  P7: "dsh-memento",
  P8: "Causal Memory",
};

export function buildSiteSnapshot({ passive, guided, day }) {
  const byProtocol = { passive, guided };
  const ids = [...new Set([
    ...(passive.leaderboard ?? []).map((row) => row.id),
    ...(guided.leaderboard ?? []).map((row) => row.id),
  ])];
  const plugins = ids.map((id) => {
    const rows = Object.fromEntries(Object.entries(byProtocol).map(([protocol, board]) => [
      protocol,
      (board.leaderboard ?? []).find((row) => row.id === id),
    ]));
    if (!rows.passive || !rows.guided) {
      throw new Error(`${id} 缺少 Passive 或 Guided 榜单记录`);
    }
    return {
      id,
      plugin: rows.passive.plugin,
      name: DISPLAY_NAMES[id] ?? rows.passive.plugin,
      implementationOverlap: id === "P3" ? "与 dsh-mnemon 共享核心实现" : null,
      passive: summarizeRow(rows.passive),
      guided: summarizeRow(rows.guided),
    };
  });

  const handlerFailureCount = Object.values(byProtocol).reduce(
    (total, board) => total + (board.leaderboard ?? []).reduce(
      (subtotal, row) => subtotal + (row.tasks ?? []).filter((task) => /handler fa/i.test(task.reason ?? "")).length,
      0,
    ),
    0,
  );

  return {
    id: "dsh-memory-locomo20-dual-track",
    suiteId: passive.suiteId,
    evaluationDay: day,
    rerunCompletedAt: "2026-08-29",
    sampleSizePerTrack: passive.sampleSize,
    pluginCount: plugins.length,
    totalPluginTaskRecords: plugins.length * passive.sampleSize * 2,
    remainingHandlerFailures: handlerFailureCount,
    baseline: {
      passive: baselinePassed(passive),
      guided: baselinePassed(guided),
    },
    categories: passive.categoryQuota,
    protocols: {
      passive: {
        label: PROTOCOLS.passive.label,
        seedInstruction: null,
        probeInstruction: null,
        meaning: "不提示保存或检索，测自动识别、自动持久化与自动召回。",
      },
      guided: {
        label: PROTOCOLS.guided.label,
        seedInstruction: PROTOCOLS.guided.seedInstruction,
        probeInstruction: PROTOCOLS.guided.probeInstruction,
        meaning: "仅增加通用记忆操作要求，测插件被正确触发后的端到端可达能力。",
      },
    },
    rankingRule: passive.rankingRule,
    plugins,
    disclosures: [
      "两条轨道使用相同的 20 道题、答案、模型、生命周期屏障与确定性评分规则。",
      "Guided 不提供工具名、正确答案或历史会话 ID，也不直接调用厂商 API。",
      "Mem9 因缺少 MEM9_API_KEY 未参评；N/A 不等于 0 分。",
    ],
  };
}

function summarizeRow(row) {
  const usage = row.process?.meanUsage ?? {};
  return {
    rank: row.rank,
    passed: row.accuracy.passed,
    total: row.accuracy.total,
    accuracy: row.accuracy.rate,
    meanEffectiveLatencyMs: row.process.meanEffectiveTotalLatencyMs,
    p95EffectiveLatencyMs: row.process.p95EffectiveTotalLatencyMs,
    meanPromptTokens: (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0),
    totalToolCalls: row.process.totalToolCalls,
    timeoutCount: row.process.timeoutCount,
  };
}

function baselinePassed(board) {
  return (board.baselines ?? []).find((row) => row.protocol?.id === board.protocolRequest)?.accuracy?.passed ?? null;
}

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function exportSiteSnapshot(options = {}) {
  const day = options.day ?? arg("--day", new Date().toISOString().slice(0, 10));
  const records = resolve(options.records ?? arg("--records", join(evalRoot(), "records")));
  const output = resolve(
    options.output ?? arg("--output", join(evalRoot(), "..", "..", "app", "data", "memory", `locomo20-${day}.json`)),
  );
  const publicOutput = resolve(
    options.publicOutput ?? arg("--public-output", join(evalRoot(), "..", "..", "public", "data", "memory", `locomo20-${day}.json`)),
  );
  const passive = readJson(join(records, `leaderboard-dsh-locomo-refined-20-passive-${day}.json`));
  const guided = readJson(join(records, `leaderboard-dsh-locomo-refined-20-guided-${day}.json`));
  const snapshot = buildSiteSnapshot({ passive, guided, day });
  mkdirSync(dirname(output), { recursive: true });
  const body = `${JSON.stringify(snapshot, null, 2)}\n`;
  writeFileSync(output, body);
  if (publicOutput !== output) {
    mkdirSync(dirname(publicOutput), { recursive: true });
    writeFileSync(publicOutput, body);
  }
  return { output, publicOutput };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const result = exportSiteSnapshot();
  console.log(result.output);
  if (result.publicOutput !== result.output) console.log(result.publicOutput);
}
