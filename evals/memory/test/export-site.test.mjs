import assert from "node:assert/strict";
import test from "node:test";
import { buildSiteSnapshot } from "../src/export-site.mjs";

const row = (id, protocol, passed) => ({
  id,
  plugin: `plugin-${id}`,
  rank: 1,
  protocol: { id: protocol },
  accuracy: { passed, total: 20, rate: passed / 20 },
  process: {
    meanEffectiveTotalLatencyMs: 1234,
    p95EffectiveTotalLatencyMs: 2345,
    meanUsage: { inputTokens: 100, cacheReadTokens: 200 },
    totalToolCalls: 4,
    timeoutCount: 0,
  },
  tasks: [],
});

test("站点快照只导出排行指标，不带答案与本机 runDir", () => {
  const passiveRow = { ...row("P8", "passive", 13), answer: "secret", runDir: "D:/local" };
  const guidedRow = row("P8", "guided", 15);
  const common = {
    suiteId: "dsh-locomo-refined-20",
    sampleSize: 20,
    categoryQuota: { "single-hop": 12 },
    rankingRule: "same protocol only",
  };
  const snapshot = buildSiteSnapshot({
    passive: { ...common, protocolRequest: "passive", leaderboard: [passiveRow], baselines: [row("C0", "passive", 0)] },
    guided: { ...common, protocolRequest: "guided", leaderboard: [guidedRow], baselines: [row("C0", "guided", 0)] },
    day: "2026-08-28",
  });
  const serialized = JSON.stringify(snapshot);
  assert.equal(snapshot.plugins[0].passive.meanPromptTokens, 300);
  assert.equal(snapshot.baseline.passive, 0);
  assert.doesNotMatch(serialized, /secret|D:\/local/);
});
