#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadCatalog } from "./catalog.mjs";
import { loadSuite } from "./lib.mjs";
import { recordsRoot, runIdFor } from "./progress.mjs";
import { withResolvedProtocol } from "./protocol.mjs";

const catalog = loadCatalog(process.argv[2]);
const suite = loadSuite(process.argv[3] || "fixtures/locomo20.json");
const root = recordsRoot();
const day = process.argv[4] || new Date().toISOString().slice(0, 10);
const protocolRequest = arg("--protocol", "matched");
const pluginTargets = catalog.plugins.map((target) => withResolvedProtocol(target, protocolRequest));
const protocolIds = pluginTargets.length
  ? [...new Set(pluginTargets.map((target) => target.protocol.id))]
  : [withResolvedProtocol(catalog.baseline, protocolRequest).protocol.id];
const baselineTargets = protocolIds.map((id) => withResolvedProtocol(catalog.baseline, id));
const targets = [...baselineTargets, ...pluginTargets];
const categoryNames = Object.fromEntries(
  suite.tasks.map((task) => [task.category, task.category_name ?? task.title ?? task.category]),
);

const rows = targets.map((target) => summarizeTarget(target));
const leaderboards = Object.fromEntries(protocolIds.map((protocolId) => {
  const ranked = rows
    .filter((row) => row.id !== catalog.baseline.id && row.protocol.id === protocolId && row.qualityEligible)
    .sort(compareRows);
  ranked.forEach((row, index) => {
    row.rank = index + 1;
    row.rankScope = `protocol:${protocolId}`;
  });
  return [protocolId, ranked];
}));
const ranked = Object.values(leaderboards).flat();

const output = {
  generatedAt: new Date().toISOString(),
  day,
  suiteId: suite.id,
  catalogId: catalog.id,
  protocolRequest,
  sampleSize: suite.tasks.length,
  categoryQuota: Object.fromEntries(
    Object.entries(categoryNames).map(([id, name]) => [name, suite.tasks.filter((task) => task.category === id).length]),
  ),
  rankingRule: "只在相同协议内排名；同协议内先按答对数，再按多跳、时间题答对数；延迟只作过程指标；未配置或未启动者不参与质量排名",
  baseline: baselineTargets.length === 1 ? rows.find((row) => row.id === catalog.baseline.id) : null,
  baselines: rows.filter((row) => row.id === catalog.baseline.id),
  leaderboards,
  leaderboard: ranked,
  compatibilityOnly: rows.filter((row) => row.id !== catalog.baseline.id && !row.qualityEligible),
  allTargets: rows,
};

const outputPath = join(root, `leaderboard-${suite.id}-${protocolRequest}-${day}.json`);
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(outputPath);

function summarizeTarget(target) {
  const runId = runIdFor(target, day, suite);
  const dir = join(root, runId);
  const meta = readJson(join(dir, "meta.json"));
  const records = suite.tasks.map((task) => ({
    task,
    record: readJson(join(dir, `${task.id}.json`)),
  }));
  const completed = records.filter(({ record }) => ["成功", "失败", "部分"].includes(record?.answerResult));
  const runnable = completed.filter(({ record }) => record.install === "成功" && record.start === "成功");
  const qualityEligible = runnable.length === suite.tasks.length;
  const passed = runnable.filter(({ record }) => record.answerResult === "成功").length;
  const partial = runnable.filter(({ record }) => record.answerResult === "部分").length;
  const latencies = runnable.map(({ record }) => record.process?.totalLatencyMs).filter(isNumber);
  const timeoutCount = runnable.filter(({ record }) => /会话未结束/.test(record.answerReason ?? "")).length;
  const effectiveLatencies = runnable
    .map(({ record }) => record.process?.totalLatencyMs ?? (/会话未结束/.test(record.answerReason ?? "") ? 60_000 : null))
    .filter(isNumber);
  const seedLatencies = runnable.map(({ record }) => record.process?.seedLatencyMs).filter(isNumber);
  const probeLatencies = runnable.map(({ record }) => record.process?.probeLatencyMs).filter(isNumber);
  const usageRows = runnable.map(({ record }) => record.process?.totalUsage).filter(Boolean);
  const categories = {};
  for (const [id, name] of Object.entries(categoryNames)) {
    const subset = runnable.filter(({ task }) => task.category === id);
    categories[name] = {
      categoryId: id,
      total: suite.tasks.filter((task) => task.category === id).length,
      completed: subset.length,
      passed: subset.filter(({ record }) => record.answerResult === "成功").length,
    };
  }
  const install = meta?.install ?? completed[0]?.record?.install ?? "未测";
  const start = completed[0]?.record?.start ?? (install === "成功" ? "未测" : "失败");
  return {
    id: target.id,
    plugin: target.plugin,
    fullName: target.fullName,
    protocol: {
      id: target.protocol.id,
      label: target.protocol.label,
    },
    runId,
    runDir: dir,
    install,
    start,
    status: qualityEligible ? "completed" : install !== "成功" ? "install-failed-or-unconfigured" : "start-or-run-incomplete",
    qualityEligible,
    rank: null,
    notes: meta?.notes ?? "",
    accuracy: {
      passed,
      partial,
      failed: runnable.length - passed - partial,
      completed: runnable.length,
      total: suite.tasks.length,
      rate: qualityEligible ? passed / suite.tasks.length : null,
    },
    categories,
    process: {
      meanTotalLatencyMs: mean(latencies),
      meanEffectiveTotalLatencyMs: mean(effectiveLatencies),
      p50TotalLatencyMs: percentile(latencies, 0.5),
      p95TotalLatencyMs: percentile(latencies, 0.95),
      p95EffectiveTotalLatencyMs: percentile(effectiveLatencies, 0.95),
      timeoutCount,
      processMissingCount: runnable.length - latencies.length - timeoutCount,
      meanSeedLatencyMs: mean(seedLatencies),
      meanProbeLatencyMs: mean(probeLatencies),
      meanUsage: sumUsage(usageRows, true),
      totalUsage: sumUsage(usageRows, false),
      meanToolCalls: mean(runnable.map(({ record }) => record.process?.totalToolCalls ?? record.process?.extraModelCalls).filter(isNumber)),
      totalToolCalls: sum(runnable.map(({ record }) => record.process?.totalToolCalls ?? record.process?.extraModelCalls).filter(isNumber)),
      meanInjectedEvents: mean(runnable.map(({ record }) => record.process?.totalInjectedCount ?? record.process?.injectedCount).filter(isNumber)),
      totalInjectedEvents: sum(runnable.map(({ record }) => record.process?.totalInjectedCount ?? record.process?.injectedCount).filter(isNumber)),
      sessionReferenceEvents: sum(runnable.map(({ record }) => record.process?.sessionReferenceCount).filter(isNumber)),
      seedEchoes: sum(runnable.map(({ record }) => record.process?.seedEchoCount).filter(isNumber)),
      foreignEchoes: sum(runnable.map(({ record }) => record.process?.foreignEchoCount).filter(isNumber)),
    },
    tasks: records.map(({ task, record }) => ({
      id: task.id,
      category: task.category_name,
      probe: task.probe,
      result: record?.answerResult ?? "未测",
      reason: record?.answerReason ?? "",
      answer: record?.answer ?? "",
      process: record?.process ?? null,
    })),
  };
}

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function compareRows(left, right) {
  return right.accuracy.passed - left.accuracy.passed ||
    categoryPassed(right, "1") - categoryPassed(left, "1") ||
    categoryPassed(right, "2") - categoryPassed(left, "2") ||
    left.plugin.localeCompare(right.plugin);
}

function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values) {
  return values.length ? Math.round(sum(values) / values.length) : null;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(fraction * sorted.length) - 1];
}

function sumUsage(rows, average) {
  if (!rows.length) return null;
  const fields = ["inputTokens", "cacheReadTokens", "cacheWriteTokens", "reasoningTokens", "outputTokens"];
  return Object.fromEntries(fields.map((field) => {
    const value = sum(rows.map((row) => row[field] ?? 0));
    return [field, average ? Math.round(value / rows.length) : value];
  }));
}

function categoryPassed(row, id) {
  const entry = Object.values(row.categories).find((item) => item.categoryId === id);
  return entry?.passed ?? 0;
}
