import assert from "node:assert/strict";
import test from "node:test";
import { Script } from "node:vm";
import { readFileSync } from "node:fs";
import { emptyProcessLedger, emptyResultLedger } from "../src/lib.mjs";
import { aggregateRecords, rankSummaries } from "../src/report.mjs";
import { PLUGINS, SUITE_ID, TASKS, publicLeaderboard, sanitizeRecord, sanitizeRecords } from "../src/public-results.mjs";
import { renderPublicHtml } from "../src/public-results-html.mjs";

function fixture(condition = "P4", taskId = "R1") {
  const p = emptyProcessLedger({ suiteId: SUITE_ID, platform: "linux" });
  p.resources = { latencyMs: 149517, inputTokens: 8095, outputTokens: 1183, totalTokens: 9278, costUsd: null, budget: null };
  p.tools.totalCalls = 24; p.tools.searchCalls = 5; p.tools.analysisCalls = 18; p.tools.budgetedCalls = 18;
  p.tools.names = { web_search: 5, bash: 18, write: 1 };
  const result = emptyResultLedger(); result.status = "PASS";
  return {
    condition, plugin: PLUGINS[condition], taskId, attempt: 1,
    track: taskId === "R10" ? "PRODUCT" : ["R1", "R3"].includes(taskId) ? "SF" : "LF",
    mode: taskId === "R10" ? "derived" : "normal",
    runId: "local-run", createdAt: "2026-09-02T03:07:39.870Z", processLedger: p, resultLedger: result,
    infrastructureAttempts: 1, discardedInfrastructureErrors: [], judge: null,
  };
}

test("allowlist discards text, identities, full URLs, nested credentials and unexpected fields", () => {
  const r = fixture(), secret = "PRIVATE_SENTINEL_please_never_publish";
  r.answer = secret; r.prompt = secret; r.gold = [secret]; r.title = secret; r.artifactText = secret;
  r.extra = { apiKey: secret }; r.processLedger.environment.model = secret;
  r.processLedger.anomalies.messages = [secret]; r.processLedger.evidenceExcerpts = [secret];
  r.processLedger.resources.key = secret; r.resultLedger.reasons = [secret, "NO_PROGRESS_TIMEOUT: " + secret];
  r.resultLedger.deliverables.checks = [{ id: secret, label: secret, met: false, critical: true }];
  r.resultLedger.risks.forbiddenContent = [secret];
  r.processLedger.sources.urls = [{ url: "https://example.invalid/" + secret, status: 200, open: true, error: secret }];
  r.processLedger.sources.answerUrls = [r.processLedger.sources.urls[0].url];
  r.processLedger.artifacts.items = [{ path: "C:\\Users\\" + secret, extension: secret, size: 20, readable: true }];
  r.processLedger.tools.names[secret] = 1;
  const clean = sanitizeRecord(r);
  assert.equal(JSON.stringify(clean).includes(secret), false);
  assert.equal(clean.processLedger.sources.items[0].citedInAnswer, true);
  assert.equal(clean.processLedger.artifacts.items[0].extension, "other");
  assert.equal(clean.processLedger.tools.names.OTHER_TOOL, 1);
  assert.deepEqual(clean.resultLedger.reasonCodes, ["NO_PROGRESS_TIMEOUT"]);
  assert.equal(clean.resultLedger.risks.forbiddenContentCount, 1);
});

test("numeric metrics, outcome and null resource values are preserved", () => {
  const r = fixture(); r.processLedger.resources.latencyMs = null;
  r.resultLedger.facts.score = 3;
  const clean = sanitizeRecord(r);
  assert.equal(clean.processLedger.resources.latencyMs, null);
  assert.equal(clean.processLedger.resources.inputTokens, 8095);
  assert.equal(clean.processLedger.tools.totalCalls, 24);
  assert.equal(clean.resultLedger.facts.score, 3);
  assert.deepEqual(aggregateRecords([clean]), aggregateRecords([r]));
});

test("unexpected values fail closed without repeating private input in errors", () => {
  const r = fixture(); r.resultLedger.status = "PRIVATE_SENTINEL";
  assert.throws(() => sanitizeRecord(r), /^Error: Unexpected public enum value$/);
  r.resultLedger.status = "PASS"; r.processLedger.resources.inputTokens = "PRIVATE_SENTINEL";
  assert.throws(() => sanitizeRecord(r), /Invalid public numeric field/);
  r.processLedger.resources.inputTokens = 1; r.plugin = "PRIVATE_SENTINEL";
  assert.throws(() => sanitizeRecord(r), /frozen catalog/);
});

test("V12 publication rejects incomplete suites and duplicate task records", () => {
  assert.throws(() => sanitizeRecords([fixture()]), /exactly 40/);
  assert.throws(() => sanitizeRecords(Array.from({ length: 40 }, () => fixture())), /Duplicate/);
});

test("public export preserves the existing ranking and standalone HTML embeds only clean data", () => {
  const raw = Object.keys(PLUGINS).flatMap((c) => TASKS.map((t) => fixture(c, t)));
  const records = sanitizeRecords(raw), generatedAt = "2026-09-04T00:00:00.000Z";
  const leaderboard = publicLeaderboard(records, generatedAt);
  assert.deepEqual(rankSummaries(aggregateRecords(records)), rankSummaries(aggregateRecords(raw)));
  const document = { suiteId: SUITE_ID, generatedAt, records };
  for (const view of ["leaderboard", "monitoring"]) {
    const html = renderPublicHtml(document, leaderboard, view);
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 2);
    assert.deepEqual(JSON.parse(scripts[0][2]), { ...document, leaderboard });
    new Script(scripts[1][2]);
    assert.equal((html.match(/data-record /g) ?? []).length, 40);
    assert.equal(/<(?:script|img)[^>]+src\s*=|<link[^>]+href\s*=/i.test(html), false);
  }
});

test("committed real snapshot has no private text fields, URLs, local paths or credential-shaped values", () => {
  const document = JSON.parse(readFileSync(new URL("../results/v12/results.json", import.meta.url), "utf8"));
  const leaderboard = JSON.parse(readFileSync(new URL("../results/v12/leaderboard.json", import.meta.url), "utf8"));
  assert.equal(document.records.length, 40);
  assert.equal(new Set(document.records.map((r) => r.runId)).size, 40);
  assert.deepEqual(publicLeaderboard(document.records, document.generatedAt), leaderboard);
  const forbiddenKey = /^(?:answer|prompt|gold|title|artifactText|evidenceExcerpts|messages|reasons|url|path|cwd|sessionId|sourcePath|apiKey|authorization|credential|secret)$/i;
  const sensitiveValue = /https?:\/\/|[a-z]:[\\/]|\/(?:home|Users)\/|\b(?:sk-[\w-]{20,}|gh[pousr]_[\w]{20,}|github_pat_[\w]{20,})|PRIVATE_SENTINEL/i;
  function inspect(value) {
    if (typeof value === "string") assert.equal(sensitiveValue.test(value), false, "Private-looking value in public snapshot");
    else if (Array.isArray(value)) value.forEach(inspect);
    else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenKey.test(key), false, "Forbidden key in public snapshot");
      inspect(child);
    }
  }
  inspect(document); inspect(leaderboard);
});
