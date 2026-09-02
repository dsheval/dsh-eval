import assert from "node:assert/strict";
import test from "node:test";
import { applyUrlChecks, foldHistory } from "../src/observe.mjs";

test("extracts search calls, structured results, providers and visible fallback", () => {
  const events = [
    { event: { type: "tool-call", data: { toolName: "web_search", arguments: { query: "official source" }, provider: "bing" } } },
    { event: { type: "tool-result", data: { toolName: "web_search", result: { note: "fallback: using exa instead", results: [{ title: "Official", url: "https://example.com/a", snippet: "evidence" }] } } } },
  ];
  const ledger = foldHistory(events, { answer: "See https://example.com/a" });
  assert.equal(ledger.tools.searchCalls, 1);
  assert.equal(ledger.results.total, 1);
  assert.equal(ledger.results.structuredCompleteness, 1);
  assert.equal(ledger.resilience.fallbacks, 1);
  assert.deepEqual(ledger.queries, ["official source"]);
  assert.ok(ledger.sources.retrievedUrls.includes("https://example.com/a"));
});

test("reasoning text and successful tool documentation do not inflate error counters", () => {
  const events = [
    { event: { type: "assistant/chunk", data: { text: "error timeout fallback provider: fake" } } },
    { event: { type: "tool/result", data: { message: { content: [{ type: "tool-result", isError: false, content: [{ type: "text", text: "Troubleshooting errors and timeouts" }] }] } } } },
    { event: { type: "tool/result", data: { message: { content: [{ type: "tool-result", isError: true, content: [{ type: "text", text: "request timed out" }] }] } } } },
  ];
  const ledger = foldHistory(events);
  assert.equal(ledger.tools.totalResults, 2);
  assert.equal(ledger.tools.successfulResults, 1);
  assert.equal(ledger.tools.failedResults, 1);
  assert.equal(ledger.resilience.errors, 1);
  assert.equal(ledger.resilience.timeouts, 1);
  assert.equal(ledger.resilience.fallbacks, 0);
  assert.deepEqual(ledger.providers, []);
});

test("URL checks distinguish unobserved and suspicious answer citations", () => {
  const ledger = foldHistory([], { answer: "https://invalid.example/not-found" });
  const checked = applyUrlChecks(ledger, [{ url: "https://invalid.example/not-found", open: false, status: 404 }]);
  assert.deepEqual(checked.sources.unobservedAnswerUrls, ["https://invalid.example/not-found"]);
  assert.deepEqual(checked.sources.suspiciousAnswerUrls, ["https://invalid.example/not-found"]);
});

test("an answer URL never counts as a retrieved URL by itself", () => {
  const ledger = foldHistory([{ event: { type: "assistant-message", data: { text: "https://made-up.example/a" } } }], { answer: "https://made-up.example/a" });
  assert.deepEqual(ledger.sources.retrievedUrls, []);
  assert.deepEqual(ledger.sources.unobservedAnswerUrls, ["https://made-up.example/a"]);
});

test("full-width Chinese closing punctuation is not included in URLs", () => {
  const ledger = foldHistory([
    {
      event: {
        type: "tool-result",
        data: { toolName: "web_search", result: { text: "来源：https://example.com/report.html）" } },
      },
    },
  ], { answer: "[来源](https://example.com/report.html）" });
  assert.deepEqual(ledger.sources.retrievedUrls, ["https://example.com/report.html"]);
  assert.deepEqual(ledger.sources.answerUrls, ["https://example.com/report.html"]);
});
