import assert from "node:assert/strict";
import { test } from "node:test";
import { applyUrlChecks, countToolCalls, detectInfrastructureFailure, foldHistory } from "../src/observe.mjs";

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

test("工具账区分搜索、管理、文件和预算型研究调用", () => {
  const summary = countToolCalls([
    { type: "tool/call", data: { toolName: "web_search", arguments: { queries: ["same query", "new query"] } } },
    { type: "tool/call", data: { toolName: "web_search", arguments: { query: " same   query " } } },
    { type: "tool/call", data: { toolName: "list_agents", arguments: {} } },
    { type: "tool/call", data: { toolName: "edit", arguments: {} } },
    { type: "tool/call", data: { toolName: "bash", arguments: { command: "python parse.py" } } },
    { type: "tool/call", data: { toolName: "fetch_page", arguments: { url: "https://example.com" } } },
  ]);
  assert.equal(summary.totalCalls, 6);
  assert.equal(summary.searchCalls, 2);
  assert.equal(summary.managementCalls, 1);
  assert.equal(summary.fileCalls, 1);
  assert.equal(summary.budgetedCalls, 2);
  assert.deepEqual(summary.queryStats, { total: 3, unique: 2, duplicate: 1, maxRepeat: 2 });
});

test("错误的零 totalTokens 不会覆盖有效输入输出用量", () => {
  const ledger = foldHistory([
    { type: "usage", data: { inputTokens: 10_720, outputTokens: 9_538, totalTokens: 0 } },
  ]);
  assert.equal(ledger.resources.totalTokens, 20_258);
});

test("父子会话 token 分别取累计最大值后求和", () => {
  const ledger = foldHistory([
    { sessionId: "root", type: "usage", data: { inputTokens: 100, outputTokens: 20, totalTokens: 120 } },
    { sessionId: "root", type: "usage", data: { inputTokens: 150, outputTokens: 30, totalTokens: 180 } },
    { sessionId: "child", type: "usage", data: { inputTokens: 70, outputTokens: 10, totalTokens: 80 } },
  ]);
  assert.equal(ledger.resources.inputTokens, 220);
  assert.equal(ledger.resources.outputTokens, 40);
  assert.equal(ledger.resources.totalTokens, 260);
});

test("模型供应商传输错误从无进展失败中独立识别", () => {
  const events = [
    { type: "assistant/chunk", data: { finish: "error", message: "DeepSeek API request to https://api.deepseek.com failed TRANSPORT" } },
    { type: "llm/retry", data: { message: "retrying" } },
  ];
  assert.equal(detectInfrastructureFailure(events), "MODEL_PROVIDER_TRANSPORT: DeepSeek API transport failure");
  assert.equal(
    detectInfrastructureFailure([{ type: "turn/end", data: { message: "Insufficient Balance QUOTA" } }]),
    "MODEL_PROVIDER_QUOTA: DeepSeek account balance is insufficient",
  );
  assert.equal(
    detectInfrastructureFailure([
      {
        type: "tool/result",
        data: { text: "DeepSeek returned an unprocessable response body: TypeError: terminated WebError WEB_PROVIDER_ERROR" },
      },
    ]),
    "MODEL_PROVIDER_WEB: DeepSeek web provider failure",
  );
  assert.equal(detectInfrastructureFailure([{ type: "tool/result", data: { text: "ordinary timeout in a webpage" } }]), null);
});
