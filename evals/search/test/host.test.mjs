import assert from "node:assert/strict";
import test from "node:test";
import { cancelAndDrain, createHost, turn } from "../src/host.mjs";

test("createHost sends session.cancel with the exact session id", async () => {
  let request;
  const host = createHost("http://127.0.0.1:3380", {
    fetch: async (_url, options) => {
      request = JSON.parse(options.body);
      return {
        json: async () => ({
          type: "server-response",
          rpcId: request.rpcId,
          result: { ok: true, value: { accepted: true } },
        }),
      };
    },
  });
  const result = await host.cancelSession("session-test");
  assert.equal(result.accepted, true);
  assert.equal(request.method, "session.cancel");
  assert.deepEqual(request.payload, { sessionId: "session-test" });
});

test("turn enforces a hard wall-clock timeout even when an RPC never settles", async () => {
  const host = {
    prompt: async () => ({ accepted: true }),
    listSessions: async () => await new Promise(() => {}),
  };
  const startedAt = Date.now();
  await assert.rejects(
    () => turn(host, "session-timeout", "prompt", { timeoutMs: 30, pollMs: 1 }),
    (error) => error?.code === "TASK_TIMEOUT",
  );
  assert.ok(Date.now() - startedAt < 250);
});

test("turn converts an operator abort into a distinct guard error", async () => {
  const controller = new AbortController();
  const host = {
    prompt: async () => ({ accepted: true }),
    listSessions: async () => await new Promise(() => {}),
  };
  setTimeout(() => controller.abort(new Error("operator stop")), 20);
  await assert.rejects(
    () => turn(host, "session-abort", "prompt", { timeoutMs: 500, signal: controller.signal }),
    (error) => error?.code === "RUN_ABORTED",
  );
});

test("turn returns the final answer after the session reaches idle", async () => {
  let polls = 0;
  const host = {
    prompt: async () => ({ accepted: true }),
    listSessions: async () => ({ items: [{ sessionId: "session-ok", running: polls++ === 0 }] }),
    history: async (_sessionId, options) => options.maxMessages === 4
      ? { events: [event("tool/call", 2, { step: 1, callId: "call-1", name: "web_search" })] }
      : { events: [event("assistant/message", 3, { message: { content: [{ type: "text", text: "final answer" }] } })] },
  };
  const result = await turn(host, "session-ok", "prompt", {
    timeoutMs: 500,
    maxAgentSteps: 5,
    maxToolCalls: 5,
    monitorPollMs: 1,
    pollMs: 1,
  });
  assert.equal(result.answer, "final answer");
  assert.equal(result.guard.observedToolCalls, 1);
});

test("turn stops a runaway agent at the step budget", async () => {
  const host = runningHost([
    event("tool/call", 10, { step: 3, callId: "call-1", name: "web_search" }),
  ]);
  await assert.rejects(
    () => turn(host, "session-steps", "prompt", {
      timeoutMs: 500,
      maxAgentSteps: 2,
      maxToolCalls: 10,
      monitorPollMs: 1,
      pollMs: 1,
    }),
    (error) => error?.code === "STEP_BUDGET_EXCEEDED" && error?.details?.maxStep === 3,
  );
});

test("turn stops immediately when a forbidden capability leaks into the search preset", async () => {
  const host = runningHost([
    event("tool/call", 10, { step: 1, callId: "call-1", name: "skill" }),
  ]);
  await assert.rejects(
    () => turn(host, "session-leak", "prompt", {
      timeoutMs: 500,
      maxAgentSteps: 10,
      maxToolCalls: 10,
      forbiddenToolNames: ["skill"],
      monitorPollMs: 1,
      pollMs: 1,
    }),
    (error) => error?.code === "CAPABILITY_LEAK",
  );
});

test("turn stops a search loop at the tool-call budget", async () => {
  const host = runningHost([
    event("tool/call", 10, { step: 1, callId: "call-1", name: "web_search" }),
    event("tool/call", 11, { step: 1, callId: "call-2", name: "web_search" }),
  ]);
  await assert.rejects(
    () => turn(host, "session-steps", "prompt", {
      timeoutMs: 500,
      maxAgentSteps: 10,
      maxToolCalls: 1,
      monitorPollMs: 1,
      pollMs: 1,
    }),
    (error) => error?.code === "TOOL_BUDGET_EXCEEDED" && error?.details?.observedToolCalls === 2,
  );
});

test("cancelAndDrain cancels, observes idle, and preserves diagnostic history", async () => {
  const events = [event("assistant/message", 5, { message: { content: [{ type: "text", text: "partial" }] } })];
  const host = {
    cancelSession: async () => ({ accepted: true }),
    listSessions: async () => ({ items: [{ sessionId: "session-cancel", running: false }] }),
    history: async () => ({ events }),
  };
  const result = await cancelAndDrain(host, "session-cancel", { cancelGraceMs: 50 });
  assert.equal(result.accepted, true);
  assert.equal(result.settled, true);
  assert.deepEqual(result.events, events);
  assert.equal(result.cancelError, null);
});

function runningHost(events) {
  return {
    prompt: async () => ({ accepted: true }),
    listSessions: async () => ({ items: [{ sessionId: "session-steps", id: "session-leak", running: true }] }),
    history: async () => ({ events }),
  };
}

function event(type, seq, data) {
  return { event: { type, seq, time: Date.now(), data } };
}
