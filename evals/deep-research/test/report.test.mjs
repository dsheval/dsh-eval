import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyProcessLedger, emptyResultLedger } from "../src/lib.mjs";
import { aggregateRecords, rankSummaries } from "../src/report.mjs";

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
    record("P1", "R5", "LF", "PARTIAL"),
    record("P2", "R1", "SF", "PASS"),
    record("P2", "R5", "LF", "PASS"),
  ];
  const summaries = aggregateRecords(rows);
  const ranked = rankSummaries(summaries);
  assert.equal(ranked[0].condition, "P2");
  assert.equal("score" in ranked[0], false);
});
