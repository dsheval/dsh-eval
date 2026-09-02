import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfiguration } from "../src/config.mjs";
import { runTask } from "../src/runner.mjs";

test("runTask cancels capability leaks, excludes cleanup from latency, and skips Judge", async () => {
  const home = join(tmpdir(), `dsh-search-runner-${process.pid}-${Date.now()}`);
  mkdirSync(home, { recursive: true });
  const config = loadConfiguration();
  const target = config.catalog.baselines.find((row) => row.id === "C0");
  const task = config.suite.tasks[0];
  let running = true;
  let selectedPreset = null;
  const events = [event("tool/call", 3, { step: 1, callId: "call-1", name: "skill" })];
  const host = {
    listWorkspaces: async () => ({ items: [] }),
    createWorkspace: async () => ({ workspaceId: "workspace-test" }),
    createSession: async (payload) => {
      selectedPreset = payload.agentPreset;
      return { sessionId: "session-test" };
    },
    prompt: async () => ({ accepted: true }),
    listSessions: async () => ({ items: [{ sessionId: "session-test", running }] }),
    history: async () => ({ events }),
    cancelSession: async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      running = false;
      return { accepted: true };
    },
  };
  try {
    const record = await runTask({
      config,
      target,
      task,
      home,
      host,
      meta: {
        runId: "run-test",
        batchId: "batch-test",
        comparisonKey: "comparison-test",
        modelLabel: "model-test",
        judgeModel: "judge-test",
      },
      attempt: 1,
    });
    assert.equal(selectedPreset, "search-eval");
    assert.equal(record.result.status, "SYSTEM_ERROR");
    assert.match(record.result.reasons.join(" "), /CAPABILITY_LEAK/u);
    assert.equal(record.judge.code, "SKIPPED_SYSTEM_ERROR");
    assert.equal(record.execution.cleanup.accepted, true);
    assert.equal(record.execution.cleanup.settled, true);
    assert.ok(record.execution.cleanup.durationMs >= 35);
    assert.ok(record.result.metrics.latencyMs < record.execution.cleanup.durationMs);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

function event(type, seq, data) {
  return { event: { type, seq, time: Date.now(), data } };
}
