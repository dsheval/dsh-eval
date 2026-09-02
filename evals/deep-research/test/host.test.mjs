import assert from "node:assert/strict";
import { test } from "node:test";
import { EvaluationBudgetError, collectSessionEvents, isInterimAssistantText, waitIdle, waitReady } from "../src/host.mjs";

function page(text) {
  return {
    events: [
      {
        type: "assistant/message",
        data: { message: { content: [{ type: "text", text }] } },
      },
    ],
  };
}

test("明确等待子代理的播报不是最终回答", () => {
  assert.equal(isInterimAssistantText("Four subagents are still running; synthesis is pending."), true);
  assert.equal(isInterimAssistantText("子代理仍在运行，等待汇总后给出最终报告。"), true);
  assert.equal(isInterimAssistantText("Final report: all requested comparisons are complete."), false);
});

test("Host 子进程提前退出时就绪检查立即失败", async () => {
  await assert.rejects(
    waitReady("http://127.0.0.1:3999", { child: { exitCode: 17 }, timeoutMs: 60_000 }),
    /exitCode=17/,
  );
});

test("waitIdle 跳过中间状态并等待稳定的最终回答", async () => {
  let clock = 0;
  let listCalls = 0;
  let historyCalls = 0;
  const interim = page("Subagents are still running; synthesis is pending.");
  const final = page("Final report: complete.");
  const host = {
    async listSessions() {
      listCalls += 1;
      return { items: [{ sessionId: "session-1", running: listCalls === 1 }] };
    },
    async history() {
      historyCalls += 1;
      return historyCalls < 3 ? interim : final;
    },
  };
  const result = await waitIdle(host, "session-1", {
    timeoutMs: 100,
    finalAnswerSettleMs: 10,
    pollIntervalMs: 5,
    now: () => clock,
    delay: async (ms) => {
      clock += ms;
    },
  });
  assert.deepEqual(result.events, final.events);
  assert.equal(result.allEvents.length, 1);
  assert.ok(historyCalls >= 4);
});

test("稳定存在的子代理中间播报最终按超时处理而不是交给评分器", async () => {
  let clock = 0;
  const host = {
    async listSessions() {
      return { items: [{ sessionId: "session-1", running: false }] };
    },
    async history() {
      return page("Baseline verification is complete, but four subagents are still running and synthesis is pending.");
    },
  };
  await assert.rejects(
    waitIdle(host, "session-1", {
      timeoutMs: 30,
      initialResponseGraceMs: 0,
      finalAnswerSettleMs: 5,
      pollIntervalMs: 5,
      now: () => clock,
      delay: async (ms) => {
        clock += ms;
      },
    }),
    (error) => error instanceof EvaluationBudgetError && error.code === "TASK_TIME_BUDGET_EXCEEDED",
  );
});

function toolPage(names) {
  return {
    events: names.map((toolName) => ({
      type: "tool/call",
      data: { toolName, arguments: { query: "test" } },
    })),
  };
}

test("搜索次数超过分轨上限时立即熔断", async () => {
  const host = {
    async listSessions() {
      return { items: [{ sessionId: "session-1", running: true, updatedAt: "same" }] };
    },
    async history() {
      return toolPage(["web_search", "web_search", "web_search"]);
    },
  };
  await assert.rejects(
    waitIdle(host, "session-1", {
      budget: { maxSearchCalls: 2, maxToolCalls: 10, noProgressMs: 100, pollIntervalMs: 1 },
    }),
    (error) => error instanceof EvaluationBudgetError && error.code === "SEARCH_BUDGET_EXCEEDED",
  );
});

test("总工具调用超过上限时立即熔断", async () => {
  const host = {
    async listSessions() {
      return { items: [{ sessionId: "session-1", running: true, updatedAt: "same" }] };
    },
    async history() {
      return toolPage(["web_search", "browser_open", "python", "write_file"]);
    },
  };
  await assert.rejects(
    waitIdle(host, "session-1", {
      budget: { maxSearchCalls: 10, maxToolCalls: 3, noProgressMs: 100, pollIntervalMs: 1 },
    }),
    (error) => error instanceof EvaluationBudgetError && error.code === "TOOL_BUDGET_EXCEEDED",
  );
});

test("父会话预算聚合子代理，但不把管理和文件工具计入研究工具预算", async () => {
  const host = {
    async listSessions() {
      return {
        items: [
          { sessionId: "root", running: true, updatedAt: "same" },
          { sessionId: "child", parentSessionId: "root", running: true, updatedAt: "same" },
        ],
      };
    },
    async history(sessionId) {
      return sessionId === "root"
        ? toolPage(["list_agents", "read_file"])
        : toolPage(["browser_open", "python"]);
    },
  };
  const events = await collectSessionEvents(host, "root");
  assert.deepEqual(new Set(events.map((event) => event.sessionId)), new Set(["root", "child"]));
  await assert.rejects(
    waitIdle(host, "root", {
      budget: { maxSearchCalls: null, maxToolCalls: null, maxBudgetedCalls: 1, maxQueryRepeats: 10, noProgressMs: 100, pollIntervalMs: 1 },
    }),
    (error) => error instanceof EvaluationBudgetError && error.code === "RESEARCH_TOOL_BUDGET_EXCEEDED",
  );
});

test("父子代理重复同一查询时触发独立的查询去重熔断", async () => {
  const host = {
    async listSessions() {
      return {
        items: [
          { sessionId: "root", running: true, updatedAt: "same" },
          { sessionId: "child", parentSessionId: "root", running: true, updatedAt: "same" },
        ],
      };
    },
    async history() {
      return toolPage(["web_search", "web_search"]);
    },
  };
  await assert.rejects(
    waitIdle(host, "root", {
      budget: { maxSearchCalls: null, maxToolCalls: null, maxBudgetedCalls: 10, maxQueryRepeats: 2, noProgressMs: 100, pollIntervalMs: 1 },
    }),
    (error) => error instanceof EvaluationBudgetError && error.code === "DUPLICATE_QUERY_BUDGET_EXCEEDED",
  );
});

test("会话状态和历史均无变化时触发无进展熔断", async () => {
  let clock = 0;
  const host = {
    async listSessions() {
      return { items: [{ sessionId: "session-1", running: true, updatedAt: "same" }] };
    },
    async history() {
      return { events: [] };
    },
  };
  await assert.rejects(
    waitIdle(host, "session-1", {
      timeoutMs: 100,
      pollIntervalMs: 5,
      budget: { maxSearchCalls: 10, maxToolCalls: 10, noProgressMs: 15, pollIntervalMs: 5 },
      now: () => clock,
      delay: async (ms) => {
        clock += ms;
      },
    }),
    (error) => error instanceof EvaluationBudgetError && error.code === "NO_PROGRESS_TIMEOUT",
  );
});
