import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { emptyProcessLedger, emptyResultLedger, writeJson } from "../src/lib.mjs";
import { aggregateRecords, effectiveTotalTokens, rankSummaries, readRecords, selectLatestSuiteRecords } from "../src/report.mjs";

function record(condition, taskId, track, status, extra = {}) {
  const resultLedger = emptyResultLedger();
  resultLedger.status = status;
  Object.assign(resultLedger, extra);
  return {
    condition,
    plugin: condition === "C0" ? "none" : condition,
    taskId,
    track,
    processLedger: emptyProcessLedger(),
    resultLedger,
  };
}

test("汇总不生成加权总分，按字典序排名", () => {
  const rows = [
    record("C0", "R1", "SF", "FAIL"),
    record("P1", "R1", "SF", "PASS"),
    record("P1", "R6", "LF", "PARTIAL"),
    record("P2", "R1", "SF", "PASS"),
    record("P2", "R6", "LF", "PASS"),
  ];
  const summaries = aggregateRecords(rows);
  const ranked = rankSummaries(summaries);
  assert.equal(ranked[0].condition, "P2");
  assert.equal("score" in ranked[0], false);
});

test("报告聚合会修正历史记录中的零 totalTokens", () => {
  const record = {
    processLedger: {
      resources: { inputTokens: 10_720, outputTokens: 9_538, totalTokens: 0 },
    },
  };
  assert.equal(effectiveTotalTokens(record), 20_258);
});

test("报告只选择最新题集版本，避免新旧基线混算", () => {
  const oldRecord = record("C0", "R1", "SF", "PASS");
  oldRecord.createdAt = "2026-08-28T00:00:00.000Z";
  oldRecord.processLedger.environment.suiteId = "suite-v2";
  const currentRecord = record("C0", "R1", "SF", "PASS");
  currentRecord.createdAt = "2026-08-29T00:00:00.000Z";
  currentRecord.processLedger.environment.suiteId = "suite-v3";
  const selected = selectLatestSuiteRecords([oldRecord, currentRecord]);
  assert.equal(selected.suiteId, "suite-v3");
  assert.deepEqual(selected.records, [currentRecord]);
});

test("同一条件优先选择完整组合运行而不是单题刷新运行", () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-report-"));
  try {
    const single = record("C0", "R3", "SF", "PASS");
    single.createdAt = "2026-09-02T01:00:00.000Z";
    single.processLedger.environment.suiteId = "suite-v12";
    writeJson(join(root, "single", "meta.json"), {
      runId: "single",
      suiteId: "suite-v12",
      condition: "C0",
      status: "COMPLETED",
      completedAt: "2026-09-02T01:00:00.000Z",
      taskSelection: ["R3"],
    });
    writeJson(join(root, "single", "R3-attempt-1.json"), single);

    const full = [record("C0", "R1", "SF", "PASS"), record("C0", "R3", "SF", "FAIL")];
    for (const item of full) {
      item.createdAt = "2026-09-02T02:00:00.000Z";
      item.processLedger.environment.suiteId = "suite-v12";
    }
    writeJson(join(root, "full", "meta.json"), {
      runId: "full",
      suiteId: "suite-v12",
      condition: "C0",
      status: "COMPLETED",
      completedAt: "2026-09-02T02:00:00.000Z",
      composite: { schemaVersion: 1 },
    });
    writeJson(join(root, "full", "R1-attempt-1.json"), full[0]);
    writeJson(join(root, "full", "R3-attempt-1.json"), full[1]);

    assert.deepEqual(readRecords(root).map((item) => item.taskId).sort(), ["R1", "R3"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
