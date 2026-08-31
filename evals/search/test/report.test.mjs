import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildReport } from "../src/report.mjs";

test("reports never merge different comparison keys", () => {
  const root = join(tmpdir(), `dsh-search-report-${process.pid}-${Date.now()}`);
  mkdirSync(join(root, "a"), { recursive: true });
  mkdirSync(join(root, "b"), { recursive: true });
  const base = { condition: "C0", plugin: "none", taskId: 1, processLedger: { environment: { suiteId: "dsh-search-hard12-v1" } }, result: { status: "PASS", pairedVsC0: "NOT_COMPARABLE", metrics: { claimSupport: 1 } } };
  writeFileSync(join(root, "a", "task-1-attempt-1.json"), JSON.stringify({ ...base, batchId: "A", comparisonKey: "key-a" }));
  writeFileSync(join(root, "b", "task-1-attempt-1.json"), JSON.stringify({ ...base, batchId: "B", comparisonKey: "key-b" }));
  try {
    const report = buildReport(root);
    assert.equal(report.batches.length, 2);
    assert.equal(report.batches[0].baseline.expectedTaskCount, 12);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
