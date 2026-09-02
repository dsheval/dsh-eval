#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const runDir = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(runDir)) {
  console.error("Usage: node scripts/validate-condition-run.mjs <run-directory>");
  process.exit(2);
}

const meta = JSON.parse(readFileSync(resolve(runDir, "meta.json"), "utf8"));
const records = readdirSync(runDir)
  .filter((name) => /^R(?:[1-9]|10)-attempt-1\.json$/u.test(name))
  .map((name) => JSON.parse(readFileSync(resolve(runDir, name), "utf8")));
const byTask = Object.fromEntries(records.map((record) => [record.taskId, record]));
const issues = [];
const fullExpected = ["R1", "R3", "R6", "R7", "R10"];
const expected = Array.isArray(meta.taskSelection) && meta.taskSelection.length ? meta.taskSelection : fullExpected;
if (meta.status !== "COMPLETED") issues.push(`run status is ${meta.status}`);
for (const taskId of expected) {
  const record = byTask[taskId];
  if (!record) {
    issues.push(`${taskId} missing`);
    continue;
  }
  if (!["PASS", "PARTIAL", "FAIL"].includes(record.resultLedger.status)) {
    issues.push(`${taskId} is not quality-scorable: ${record.resultLedger.status}`);
  }
  if (["R6", "R7"].includes(taskId) && record.judge?.ok !== true) {
    issues.push(`${taskId} has no successful Judge verdict`);
  }
  if (record.runId !== meta.runId) issues.push(`${taskId} runId does not match meta`);
  if (record.condition !== meta.condition) issues.push(`${taskId} condition does not match meta`);
  if (record.processLedger?.environment?.suiteId !== meta.suiteId) issues.push(`${taskId} suiteId does not match meta`);
  if (meta.composite) {
    const source = meta.composite.sources?.[taskId];
    if (!source) issues.push(`${taskId} composite source missing`);
    if (record.provenance?.sourceRunId !== source?.runId) issues.push(`${taskId} provenance sourceRunId mismatch`);
    if (record.provenance?.sourceSuiteId !== source?.suiteId) issues.push(`${taskId} provenance sourceSuiteId mismatch`);
    if (record.provenance?.reused !== source?.reused) issues.push(`${taskId} provenance reuse flag mismatch`);
  }
}
if (meta.composite && expected.length !== fullExpected.length) issues.push("composite run must contain the full task set");

const output = {
  ok: issues.length === 0,
  runId: meta.runId,
  condition: meta.condition,
  taskSelection: expected,
  statuses: Object.fromEntries(expected.map((taskId) => [taskId, byTask[taskId]?.resultLedger?.status ?? "MISSING"])),
  infrastructureAttempts: Object.fromEntries(expected.map((taskId) => [taskId, byTask[taskId]?.infrastructureAttempts ?? null])),
  issues,
};
console.log(JSON.stringify(output, null, 2));
if (!output.ok) process.exitCode = 1;
