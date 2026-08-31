import assert from "node:assert/strict";
import test from "node:test";
import { comparePaired, scoreTask } from "../src/score.mjs";

const thresholds = {
  minimumRetrievalCalls: 1,
  minimumRetrievedUrls: 1,
  minimumOpenUrls: 1,
  minimumToolSuccessRate: 0.5,
  minimumStructuredCompleteness: 0.5,
  minimumClaimSupport: 0.6,
  minimumCitationCorrectness: 0.5,
};

function ledger(overrides = {}) {
  return {
    tools: { searchCalls: 1, fetchCalls: 0, successRate: 1 },
    results: { structuredCompleteness: 1 },
    sources: { retrievedUrls: ["https://example.com"], retrievedOpenUrls: 1, uniqueDomains: 1, urlValidity: 1, suspiciousAnswerUrls: [] },
    resilience: { fallbacks: 0, errors: 0, timeouts: 0 },
    resources: { latencyMs: 100 },
    ...overrides,
  };
}

function judge(overrides = {}) {
  return { ok: true, verdict: { status: "PASS", sourceQuality: 4, citationCorrectness: 4, citationCompleteness: 4, claimSupport: 1, primarySourceRatio: 1, keyClaims: 2, supportedKeyClaims: 2, unsupportedClaims: 0, fabricatedCitations: 0, reasons: [], ...overrides } };
}

test("passes only when retrieval and evidence gates pass", () => {
  const result = scoreTask({ task: { id: 1 }, answer: "answer", processLedger: ledger(), judge: judge(), thresholds });
  assert.equal(result.status, "PASS");
});

test("no observed search is a retrieval failure even if an answer exists", () => {
  const processLedger = ledger({ tools: { searchCalls: 0, fetchCalls: 0, successRate: null }, sources: { retrievedUrls: [], retrievedOpenUrls: 0, uniqueDomains: 0, urlValidity: null, suspiciousAnswerUrls: [] } });
  const result = scoreTask({ task: { id: 1 }, answer: "plausible closed-book answer", processLedger, judge: judge(), thresholds });
  assert.equal(result.status, "RETRIEVAL_FAIL");
});

test("fabricated citations are an unconditional quality failure", () => {
  const result = scoreTask({ task: { id: 1 }, answer: "answer", processLedger: ledger(), judge: judge({ fabricatedCitations: 1 }), thresholds });
  assert.equal(result.status, "FAIL");
});

test("an inaccessible unobserved URL downgrades citation integrity but is not itself fabrication", () => {
  const processLedger = ledger({ sources: { retrievedUrls: ["https://example.com"], retrievedOpenUrls: 1, uniqueDomains: 1, urlValidity: 1, suspiciousAnswerUrls: ["https://broken.example"] } });
  const result = scoreTask({ task: { id: 1 }, answer: "answer", processLedger, judge: judge(), thresholds });
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.gates.citationUrlIntegrity, false);
});

test("paired comparison is risk-first and requires two-dimension margin", () => {
  const baseline = { status: "PASS", metrics: { fabricatedCitations: 0, claimSupport: 0.6, citationCorrectness: 0.6, citationCompleteness: 0.6, sourceQuality: 0.6, urlValidity: 0.8, toolSuccessRate: 0.8, structuredCompleteness: 0.8 } };
  const plugin = { status: "PASS", metrics: { ...baseline.metrics, claimSupport: 0.8, citationCorrectness: 0.8 } };
  assert.equal(comparePaired(plugin, baseline, 0.05), "WIN");
  assert.equal(comparePaired({ ...plugin, metrics: { ...plugin.metrics, fabricatedCitations: 1 } }, baseline, 0.05), "LOSS");
});
