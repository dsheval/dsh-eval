import assert from "node:assert/strict";
import { test } from "node:test";
import { getTask, loadSuite } from "../src/lib.mjs";
import {
  addUsageTotals,
  foldProcess,
  formatProcess,
  inferDump,
  processDelta,
  usageTotals,
} from "../src/observe.mjs";

const suite = loadSuite();
const task = (id) => getTask(suite, id);
const locomo = loadSuite("fixtures/locomo20.json");
const locomoTask = (id) => getTask(locomo, id);

test("T7 追问历史里出现大量废话记灌窗", () => {
  const t7 = task("T7");
  const events = t7.noiseSeeds.slice(0, 9).map((line, index) => ({
    event: {
      type: "user/message",
      data: { content: [{ type: "text", text: line }], source: { type: "inject" } },
      seq: index,
    },
  }));
  assert.equal(inferDump(t7, events), true);
  assert.equal(foldProcess(t7, events).dumpedAllNoise, true);
});

test("T7 只回频道、历史没有废话，不算灌窗", () => {
  const t7 = task("T7");
  const events = [
    {
      event: {
        type: "assistant/message",
        data: { message: { role: "assistant", content: [{ type: "text", text: "harbor-release" }] } },
      },
    },
    {
      event: {
        type: "assistant/chunk",
        data: { turn: 1, step: 1, chunk: { type: "usage", usage: { inputTokens: 200 } } },
      },
    },
  ];
  assert.equal(inferDump(t7, events), false);
  assert.equal(foldProcess(t7, events).injectedTokens, 200);
});

test("绝对 token 高但没有废话，不算灌窗", () => {
  const t7 = task("T7");
  const events = [
    {
      event: {
        type: "assistant/chunk",
        data: { usage: { inputTokens: 20000 } },
      },
    },
  ];
  assert.equal(inferDump(t7, events), false);
  assert.equal(foldProcess(t7, events).dumpedAllNoise, false);
});

test("注入 token 取最后一次 usage，不累加 chunk", () => {
  const events = [
    { event: { type: "assistant/chunk", data: { usage: { inputTokens: 20000 } } } },
    { event: { type: "assistant/chunk", data: { chunk: { usage: { inputTokens: 21000 } } } } },
  ];
  assert.equal(foldProcess(task("T1"), events).injectedTokens, 21000);
});

test("过程账只读事件，工具次数记入 extraModelCalls", () => {
  const process = foldProcess(task("T1"), [
    { event: { type: "tool/call", data: { name: "recall" }, time: 10 } },
    {
      event: {
        type: "assistant/message",
        data: { content: [{ type: "text", text: "ok" }] },
        time: 40,
      },
    },
  ]);
  assert.equal(process.latencyMs, 30);
  assert.equal(process.extraModelCalls, 1);
  assert.equal(process.seedToolCalls, 0);
  assert.equal(process.probeToolCalls, 1);
  assert.equal(process.totalToolCalls, 1);
  assert.equal(process.dumpedAllNoise, null);
});

test("过程账分别统计埋点与追问阶段的工具和注入", () => {
  const seedEvents = [
    { event: { type: "tool/call", data: { name: "remember" } } },
    { event: { type: "user/message", data: { source: { kind: "memory-seed" } } } },
  ];
  const probeEvents = [
    { event: { type: "tool/call", data: { name: "recall" } } },
    { event: { type: "user/message", data: { source: { kind: "memory-recall" } } } },
  ];
  const process = foldProcess(task("T1"), probeEvents, { seedEvents });
  assert.equal(process.seedToolCalls, 1);
  assert.equal(process.probeToolCalls, 1);
  assert.equal(process.totalToolCalls, 2);
  assert.equal(process.extraModelCalls, 2);
  assert.equal(process.seedInjectedCount, 1);
  assert.equal(process.probeInjectedCount, 1);
  assert.equal(process.totalInjectedCount, 2);
});

test("LoCoMo 追问历史回声本题材记 seedEcho", () => {
  const l01 = locomoTask("L01");
  const process = foldProcess(
    l01,
    [
      {
        event: {
          type: "user/message",
          data: { content: l01.seeds[0], source: { type: "inject" } },
        },
      },
    ],
    { suite: locomo },
  );
  assert.equal(process.seedEchoCount, 1);
  assert.equal(process.seedCount, 1);
  assert.equal(process.foreignEchoCount, 0);
});

test("LoCoMo 追问里出现其他题埋点记 foreignEcho", () => {
  const l01 = locomoTask("L01");
  const l02 = locomoTask("L02");
  const process = foldProcess(
    l01,
    [
      {
        event: {
          type: "user/message",
          data: { content: l02.seeds[0], source: { type: "inject" } },
        },
      },
    ],
    { suite: locomo },
  );
  assert.equal(process.seedEchoCount, 0);
  assert.ok(process.foreignEchoCount >= 1);
});

test("过程增量只和 C0 做减法，不合成总分", () => {
  const delta = processDelta(
    { injectedTokens: 24000, extraModelCalls: 2, injectedCount: 4, latencyMs: 80000 },
    { injectedTokens: 21000, extraModelCalls: 1, injectedCount: 2, latencyMs: 60000 },
  );
  assert.deepEqual(delta, {
    promptTokenDelta: 3000,
    toolCallDelta: 1,
    injectedDelta: 2,
    latencyDeltaMs: 20000,
  });
  assert.match(formatProcess({ injectedTokens: 24000, seedEchoCount: 1, seedCount: 2, extraModelCalls: 2, injectedCount: 4, latencyMs: 80000 }, delta), /\+3000/);
});

test("会单独统计 DSH session-reference 注入", () => {
  const process = foldProcess(locomoTask("L01"), [
    {
      event: {
        type: "user/message",
        data: {
          content: [{ type: "text", text: "old session" }],
          source: { kind: "session-reference" },
        },
      },
    },
  ]);
  assert.equal(process.sessionReferenceCount, 1);
  assert.match(formatProcess(process), /session-ref/);
});

test("会单独统计 DSH session-reference 注入", () => {
  const process = foldProcess(locomoTask("L01"), [
    {
      event: {
        type: "user/message",
        data: {
          content: [{ type: "text", text: "old session" }],
          source: { kind: "session-reference" },
        },
      },
    },
  ]);
  assert.equal(process.sessionReferenceCount, 1);
  assert.match(formatProcess(process), /session-ref/);
});

test("过程账拆分输入、缓存、推理和输出 token", () => {
  const usage = usageTotals([
    {
      event: {
        type: "assistant/message",
        data: { usage: { inputTokens: 4, cacheReadTokens: 512, reasoningTokens: 20, outputTokens: 30 } },
      },
    },
  ]);
  assert.deepEqual(usage, {
    inputTokens: 4,
    cacheReadTokens: 512,
    cacheWriteTokens: 0,
    reasoningTokens: 20,
    outputTokens: 30,
  });
  assert.deepEqual(addUsageTotals(usage, usage), {
    inputTokens: 8,
    cacheReadTokens: 1024,
    cacheWriteTokens: 0,
    reasoningTokens: 40,
    outputTokens: 60,
  });
});
