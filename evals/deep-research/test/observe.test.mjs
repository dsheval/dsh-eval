import assert from "node:assert/strict";
import { test } from "node:test";
import { applyUrlChecks, foldHistory } from "../src/observe.mjs";

test("history 被折叠为精简过程账", () => {
  const events = [
    { type: "tool/call", data: { toolName: "web_search", arguments: { q: "test" } } },
    { type: "tool/result", data: { toolName: "web_search", text: "source https://example.com/a" } },
    { type: "tool/call", data: { toolName: "fetch_page", input: { url: "https://example.com/a" } } },
    { type: "assistant/message", data: { message: { content: [{ type: "text", text: "计划：\n1. 子问题一\n报告见 D:\\tmp\\report.md\n引用 https://example.com/a" }] } } },
    { type: "usage", data: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
    { type: "tool/error", data: { message: "timeout, retry with fallback" } },
  ];
  let ledger = foldHistory(events, { answer: "最终报告 https://example.com/b", startedAt: 1000, endedAt: 3000 });
  ledger = applyUrlChecks(ledger, [
    { url: "https://example.com/a", open: true, status: 200 },
    { url: "https://example.com/b", open: false, status: 404 },
  ]);
  assert.equal(ledger.tools.totalCalls, 2);
  assert.equal(ledger.tools.searchCalls, 1);
  assert.equal(ledger.tools.fetchCalls, 1);
  assert.equal(ledger.research.planVisible, true);
  assert.equal(ledger.research.subquestionsVisible, true);
  assert.equal(ledger.sources.totalUrls, 2);
  assert.equal(ledger.sources.openUrls, 1);
  assert.deepEqual(ledger.sources.answerUrls, ["https://example.com/b"]);
  assert.equal(ledger.sources.answerOpenUrls, 0);
  assert.equal(ledger.anomalies.timeouts, 1);
  assert.equal(ledger.anomalies.retries, 1);
  assert.equal(ledger.anomalies.fallbacks, 1);
  assert.equal(ledger.resources.totalTokens, 150);
  assert.equal(ledger.resources.latencyMs, 2000);
  assert.deepEqual(ledger.artifacts.paths, ["D:\\tmp\\report.md"]);
});
