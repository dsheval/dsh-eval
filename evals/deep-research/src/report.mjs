import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { mean, readJson, ratio, writeJson } from "./lib.mjs";

export function aggregateRecords(records) {
  const groups = new Map();
  for (const record of records) {
    const key = record.condition;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].map(([condition, rows]) => summarizeCondition(condition, rows));
}

export function summarizeCondition(condition, records) {
  const scorable = records.filter((record) => ["PASS", "PARTIAL", "FAIL"].includes(record.resultLedger.status));
  const longform = scorable.filter((record) => record.track === "LF");
  const shortFact = scorable.filter((record) => record.track === "SF");
  const statusCounts = countBy(records, (record) => record.resultLedger.status);
  const upliftCounts = countBy(records, (record) => record.resultLedger.uplift);
  const fabricated = records.reduce(
    (sum, record) => sum + (record.resultLedger.risks.fabricatedFacts ?? 0) + (record.resultLedger.risks.fabricatedCitations ?? 0),
    0,
  );
  return {
    condition,
    plugin: records[0]?.plugin ?? "",
    totalRecords: records.length,
    scorableRecords: scorable.length,
    qualityEligible: scorable.length > 0 && fabricated === 0,
    statusCounts,
    sf: {
      passed: shortFact.filter((record) => record.resultLedger.status === "PASS").length,
      total: shortFact.length,
    },
    lf: {
      passed: longform.filter((record) => record.resultLedger.status === "PASS").length,
      partial: longform.filter((record) => record.resultLedger.status === "PARTIAL").length,
      failed: longform.filter((record) => record.resultLedger.status === "FAIL").length,
      total: longform.length,
    },
    citationValidity: mean(records.map((record) => record.resultLedger.citations.validity)),
    citationFaithfulness: mean(records.map((record) => record.resultLedger.citations.faithful)),
    keyClaimCoverage: mean(records.map((record) => record.resultLedger.citations.keyClaimCoverage)),
    recoveryPasses: records.filter((record) => record.resultLedger.recovery === "PASS").length,
    systemFailureRate: ratio(statusCounts.SYSTEM_ERROR ?? 0, records.length),
    fabricatedTotal: fabricated,
    upliftCounts,
    efficiency: {
      meanLatencyMs: mean(records.map((record) => record.processLedger.resources.latencyMs)),
      meanTokens: mean(records.map((record) => record.processLedger.resources.totalTokens)),
      meanCostUsd: mean(records.map((record) => record.processLedger.resources.costUsd)),
    },
  };
}

export function rankSummaries(summaries) {
  const plugins = summaries.filter((item) => item.condition !== "C0");
  return [...plugins].sort((left, right) => {
    const eligible = Number(right.qualityEligible) - Number(left.qualityEligible);
    if (eligible) return eligible;
    const fabricated = left.fabricatedTotal - right.fabricatedTotal;
    if (fabricated) return fabricated;
    const lf = (right.lf.passed - left.lf.passed) || (right.lf.partial - left.lf.partial);
    if (lf) return lf;
    const faith = (right.citationFaithfulness ?? -1) - (left.citationFaithfulness ?? -1);
    if (faith) return faith;
    const sf = right.sf.passed - left.sf.passed;
    if (sf) return sf;
    const recovery = right.recoveryPasses - left.recoveryPasses;
    if (recovery) return recovery;
    const negative = (left.upliftCounts.NEGATIVE ?? 0) - (right.upliftCounts.NEGATIVE ?? 0);
    if (negative) return negative;
    return (left.efficiency.meanLatencyMs ?? Infinity) - (right.efficiency.meanLatencyMs ?? Infinity);
  });
}

export function readRecords(root) {
  if (!existsSync(root)) return [];
  const records = [];
  for (const runName of readdirSync(root)) {
    const runDir = join(root, runName);
    let names = [];
    try {
      names = readdirSync(runDir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!/^R(?:[1-9]|10)-attempt-\d+\.json$/.test(name)) continue;
      records.push(readJson(join(runDir, name)));
    }
  }
  return records;
}

export function writeLeaderboard(recordsRoot, outputPath) {
  const records = readRecords(recordsRoot);
  const summaries = aggregateRecords(records);
  const leaderboard = rankSummaries(summaries).map((item, index) => ({ rank: index + 1, ...item }));
  const document = {
    generatedAt: new Date().toISOString(),
    rankingRule: "准入 → 编造 → LF PASS/PARTIAL → 引用忠实度 → SF PASS → 恢复 → 负增量 → 效率",
    baseline: summaries.find((item) => item.condition === "C0") ?? null,
    leaderboard,
    allConditions: summaries,
  };
  writeJson(outputPath, document);
  return document;
}

function countBy(rows, selector) {
  const counts = {};
  for (const row of rows) {
    const key = selector(row) ?? "UNKNOWN";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
