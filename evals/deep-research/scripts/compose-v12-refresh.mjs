#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfiguration } from "../src/config.mjs";
import { EVAL_ROOT, createRunId, isoNow, writeJson } from "../src/lib.mjs";

const OLD_SUITE = "dsh-research-eval-v11-calibrated-protocol";
const NEW_SUITE = "dsh-research-eval-v12-r3-refresh";
const EXPECTED = ["R1", "R3", "R6", "R7", "R10"];
const REUSED = EXPECTED.filter((taskId) => taskId !== "R3");
const recordsRoot = join(EVAL_ROOT, "records");
const config = loadConfiguration();

if (config.suite.id !== NEW_SUITE) throw new Error(`当前题集不是 ${NEW_SUITE}`);

const conditions = [config.catalog.baseline, ...config.catalog.plugins.filter((target) => target.evaluation?.enabled !== false)];
const runs = loadRuns(recordsRoot);
const selected = [];
const issues = [];

for (const target of conditions) {
  const base = latest(runs.filter((run) => run.meta.suiteId === OLD_SUITE && run.meta.condition === target.id && reusable(run)));
  const refresh = latest(runs.filter((run) => run.meta.suiteId === NEW_SUITE && run.meta.condition === target.id && refreshable(run)));
  if (!base) issues.push(`${target.id}: 缺少可复用的 ${OLD_SUITE} 完整运行`);
  if (!refresh) issues.push(`${target.id}: 缺少有效的 ${NEW_SUITE} R3 单题刷新运行`);
  if (base && refresh) selected.push({ target, base, refresh });
}

if (issues.length) {
  console.error(JSON.stringify({ ok: false, issues }, null, 2));
  process.exit(1);
}

const outputs = [];
for (const { target, base, refresh } of selected) {
  const runId = createRunId(`${target.id}-${target.plugin}-v12-composite`);
  const runDir = join(recordsRoot, runId);
  mkdirSync(runDir, { recursive: true });
  const now = isoNow();
  const sources = Object.fromEntries(EXPECTED.map((taskId) => [
    taskId,
    {
      runId: taskId === "R3" ? refresh.meta.runId : base.meta.runId,
      suiteId: taskId === "R3" ? NEW_SUITE : OLD_SUITE,
      reused: taskId !== "R3",
    },
  ]));
  const meta = {
    ...structuredClone(base.meta),
    runId,
    suiteId: NEW_SUITE,
    createdAt: now,
    completedAt: now,
    status: "COMPLETED",
    recordCount: EXPECTED.length,
    taskSelection: EXPECTED,
    execution: "audited-composite",
    composite: {
      schemaVersion: 1,
      refreshedTask: "R3",
      reason: "R3 benchmark contamination replacement; unchanged tasks reuse strictly validated V11 records",
      sources,
    },
  };
  writeJson(join(runDir, "meta.json"), meta);

  for (const taskId of EXPECTED) {
    const source = taskId === "R3" ? refresh : base;
    const record = structuredClone(source.records[taskId]);
    record.runId = runId;
    record.processLedger.environment.suiteId = NEW_SUITE;
    record.provenance = {
      sourceRunId: source.meta.runId,
      sourceSuiteId: source.meta.suiteId,
      reused: taskId !== "R3",
      method: taskId === "R3" ? "fresh-task-refresh" : "validated-record-reuse",
    };
    writeJson(join(runDir, `${taskId}-attempt-1.json`), record);
  }
  outputs.push({ condition: target.id, runId, runDir, baseRunId: base.meta.runId, refreshRunId: refresh.meta.runId });
}

console.log(JSON.stringify({ ok: true, suiteId: NEW_SUITE, outputs }, null, 2));

function loadRuns(root) {
  const output = [];
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    const metaPath = join(dir, "meta.json");
    if (!existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf8"));
      const records = {};
      for (const taskId of EXPECTED) {
        const path = join(dir, `${taskId}-attempt-1.json`);
        if (existsSync(path)) records[taskId] = JSON.parse(readFileSync(path, "utf8"));
      }
      output.push({ dir, meta, records });
    } catch {
      // Ignore incomplete or malformed run directories; selection below will report gaps.
    }
  }
  return output;
}

function reusable(run) {
  if (run.meta.status !== "COMPLETED" || run.meta.composite) return false;
  return REUSED.every((taskId) => {
    const record = run.records[taskId];
    if (!qualityScorable(record)) return false;
    return !["R6", "R7"].includes(taskId) || record.judge?.ok === true;
  });
}

function refreshable(run) {
  return run.meta.status === "COMPLETED"
    && !run.meta.composite
    && Array.isArray(run.meta.taskSelection)
    && run.meta.taskSelection.length === 1
    && run.meta.taskSelection[0] === "R3"
    && qualityScorable(run.records.R3);
}

function qualityScorable(record) {
  return ["PASS", "PARTIAL", "FAIL"].includes(record?.resultLedger?.status);
}

function latest(rows) {
  return [...rows].sort((left, right) => String(right.meta.completedAt ?? right.meta.createdAt).localeCompare(String(left.meta.completedAt ?? left.meta.createdAt)))[0] ?? null;
}
