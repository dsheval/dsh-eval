import assert from "node:assert/strict";
import test from "node:test";
import { aggregateBaseline, assessBaselineDrift, baselineComparabilityReason, summarizePluginCoverage } from "../src/runner.mjs";

test("two C0 brackets are averaged and the worse status is retained", () => {
  const rows = [
    { result: { status: "PASS", metrics: { claimSupport: 0.8, urlValidity: 1 } } },
    { result: { status: "PARTIAL", metrics: { claimSupport: 0.6, urlValidity: 0.8 } } },
  ];
  const aggregate = aggregateBaseline(rows);
  assert.equal(aggregate.status, "PARTIAL");
  assert.equal(aggregate.metrics.claimSupport, 0.7);
  assert.equal(aggregate.metrics.urlValidity, 0.9);
});

test("baseline drift fails closed when both 12-task brackets are absent", () => {
  const drift = assessBaselineDrift([], { suite: { taskSource: { count: 12 }, thresholds: { baselineMaxMeanAbsoluteDrift: 0.15, baselineMaxStatusMismatchRate: 0.25 } } });
  assert.equal(drift.stable, false);
  assert.equal(drift.pairCount, 0);
  assert.equal(drift.thresholds.minimumMetricPairs, 10);
  assert.equal(
    baselineComparabilityReason(drift, 1, 48),
    "C0 bracket comparison unavailable: expected 12 paired tasks, observed 0",
  );
});

test("baseline reason reserves drift wording for complete but unstable brackets", () => {
  const drift = {
    stable: false,
    expectedPairCount: 12,
    pairCount: 12,
    rankablePairCount: 12,
    metricCounts: { claimSupport: 12, citationCorrectness: 12 },
    thresholds: { minimumMetricPairs: 10 },
  };
  assert.equal(baselineComparabilityReason(drift, 1, 48), "C0 bracket drift exceeded the frozen tolerance");
  assert.equal(baselineComparabilityReason({ ...drift, stable: true }, 1, 48), null);
  assert.equal(baselineComparabilityReason({ ...drift, stable: true }, 49, 48), "batch exceeded the allowed time window");
});

test("plugin coverage cannot be publishable when a record is a system error", () => {
  const config = { catalog: { plugins: [{ id: "S1" }] }, suite: { tasks: [{}, {}] } };
  const outputs = [{
    meta: { condition: "S1", status: "COMPLETED" },
    records: [
      { result: { status: "PASS" } },
      { result: { status: "SYSTEM_ERROR" } },
    ],
  }];
  const coverage = summarizePluginCoverage(outputs, config);
  assert.equal(coverage.S1.recordCount, 2);
  assert.equal(coverage.S1.rankableCount, 1);
  assert.equal(coverage.S1.complete, false);
});
