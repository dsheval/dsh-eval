import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mean, writeJson } from "./lib.mjs";

export function buildReport(recordsRoot) {
  const records = loadRecords(recordsRoot);
  const metas = loadMetas(recordsRoot);
  const keys = new Set([...records.map(batchKey), ...metas.map(batchKey)]);
  const batches = [...keys].map((key) => {
    const batchRows = records.filter((row) => batchKey(row) === key);
    const batchMetas = metas.filter((row) => batchKey(row) === key);
    const conditionIds = new Set([...batchRows.map((row) => row.condition), ...batchMetas.map((row) => row.condition)]);
    const conditions = [...conditionIds].map((condition) => summarize(
      condition,
      batchRows.filter((row) => row.condition === condition),
      batchMetas.filter((row) => row.condition === condition),
    ));
    const exemplar = batchRows[0] ?? batchMetas[0] ?? {};
    return {
      key,
      batchId: exemplar.batchId ?? "UNRECORDED",
      comparisonKey: exemplar.comparisonKey ?? "UNRECORDED",
      baseline: conditions.find((row) => row.condition === "C0") ?? null,
      conditions,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    policy: {
      noSingleWeightedScore: true,
      primaryBaseline: "C0",
      diagnosticBaseline: "C1",
      ranking: "risk-first paired win/tie/loss; system/admission/grader errors excluded",
    },
    batches,
  };
}

export function writeReport(recordsRoot, output) {
  const report = buildReport(recordsRoot);
  writeJson(output, report);
  return report;
}

function loadRecords(root) {
  if (!existsSync(root)) return [];
  const output = [];
  for (const runName of readdirSync(root)) {
    const dir = join(root, runName);
    for (const name of safeReadDir(dir)) {
      if (!/^task-\d+-attempt-\d+\.json$/u.test(name)) continue;
      try { output.push(JSON.parse(readFileSync(join(dir, name), "utf8"))); } catch { /* incomplete record */ }
    }
  }
  return output;
}

function loadMetas(root) {
  if (!existsSync(root)) return [];
  const output = [];
  for (const runName of readdirSync(root)) {
    const path = join(root, runName, "meta.json");
    if (!existsSync(path)) continue;
    try { output.push(JSON.parse(readFileSync(path, "utf8"))); } catch { /* incomplete meta */ }
  }
  return output;
}

function summarize(condition, rows, metas = []) {
  const rankable = rows.filter((row) => ["PASS", "PARTIAL", "FAIL", "RETRIEVAL_FAIL"].includes(row.result?.status));
  const expectedTaskCount = inferExpectedTaskCount(rows, metas);
  const metrics = ["retrievalActivation", "toolSuccessRate", "structuredCompleteness", "urlValidity", "citationCorrectness", "citationCompleteness", "claimSupport", "sourceQuality", "primarySourceRatio", "providerCount", "fallbacks", "fallbackRecovery", "errors", "timeouts", "searchCalls", "fetchCalls", "latencyMs"];
  const metricMeans = Object.fromEntries(metrics.map((key) => [key, mean(rankable.map((row) => row.result.metrics[key]))]));
  const paired = rankable.map((row) => row.result.pairedVsC0).filter((value) => ["WIN", "TIE", "LOSS"].includes(value));
  return {
    condition,
    plugin: rows[0]?.plugin ?? metas[0]?.plugin ?? null,
    runStatusCounts: counts(metas.map((row) => row.status ?? "UNKNOWN")),
    recordCount: rows.length,
    rankableCount: rankable.length,
    statusCounts: counts(rows.map((row) => row.result?.status ?? "UNKNOWN")),
    pairedVsC0: counts(paired),
    metrics: metricMeans,
    expectedTaskCount,
    taskCoverageComplete: new Set(rows.map((row) => row.taskId)).size === expectedTaskCount,
  };
}

function inferExpectedTaskCount(rows, metas) {
  const recorded = metas.find((row) => Number.isInteger(row.taskCount) && row.taskCount > 0)?.taskCount;
  if (recorded) return recorded;
  const suiteId = String(rows[0]?.processLedger?.environment?.suiteId ?? metas[0]?.suiteId ?? "");
  const named = /hard(\d+)/iu.exec(suiteId)?.[1];
  return named ? Number(named) : 20;
}

function batchKey(row) {
  return `${row.batchId ?? "UNRECORDED"}::${row.comparisonKey ?? "UNRECORDED"}`;
}

function counts(values) {
  const output = {};
  for (const value of values) output[value] = (output[value] ?? 0) + 1;
  return output;
}

function safeReadDir(path) {
  try { return readdirSync(path); } catch { return []; }
}
