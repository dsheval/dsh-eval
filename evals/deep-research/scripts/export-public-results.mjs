#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { Script } from "node:vm";
import { aggregateRecords, rankSummaries, readRecords } from "../src/report.mjs";
import { PUBLIC_BOUNDARIES, SUITE_ID, publicLeaderboard, sanitizeRecords } from "../src/public-results.mjs";
import { renderPublicHtml } from "../src/public-results-html.mjs";

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const digest = (text) => createHash("sha256").update(text).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const files = ["results.json", "leaderboard.json", "leaderboard.html", "process-monitoring.html"];

function verify(root) {
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.suiteId, SUITE_ID);
  assert.deepEqual(Object.keys(manifest.files).sort(), [...files].sort());
  for (const name of files) {
    const bytes = readFileSync(join(root, name));
    assert.equal(digest(bytes), manifest.files[name].sha256, `Checksum mismatch: ${name}`);
    assert.equal(bytes.length, manifest.files[name].bytes, `Size mismatch: ${name}`);
  }
  const document = JSON.parse(readFileSync(join(root, "results.json"), "utf8"));
  assert.equal(document.records.length, 40);
  const leaderboard = JSON.parse(readFileSync(join(root, "leaderboard.json"), "utf8"));
  assert.deepEqual(publicLeaderboard(document.records, document.generatedAt), leaderboard);
  for (const name of files.filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(join(root, name), "utf8");
    const blocks = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    assert.equal(blocks.length, 2);
    assert.deepEqual(JSON.parse(blocks[0][2]), { ...document, leaderboard });
    new Script(blocks[1][2], { filename: name });
    assert.equal(/<(?:script|img)[^>]+src\s*=|<link[^>]+href\s*=/i.test(html), false, "External asset detected");
  }
  return { ok: true, records: 40, plugins: leaderboard.leaderboard.length, verifiedFiles: files.length };
}

if (option("--verify")) {
  console.log(JSON.stringify(verify(resolve(option("--verify"))), null, 2));
} else {
  if (!option("--source") || !option("--out")) throw new Error("Usage: --source <local records directory> --out <public results directory>, or --verify <public results directory>");
  const source = resolve(option("--source")), out = resolve(option("--out"));
  if (out === source || out.startsWith(source + sep)) throw new Error("Public output must be separate from raw records");
  if (!existsSync(source)) throw new Error("Source records directory does not exist");
  const raw = readRecords(source).filter((r) => r.processLedger?.environment?.suiteId === SUITE_ID);
  const records = sanitizeRecords(raw);
  for (const record of records) {
    const original = raw.find((r) => r.condition === record.condition && r.taskId === record.taskId);
    for (const key of ["tools", "resources", "research"]) assert.deepEqual(record.processLedger[key], original.processLedger[key], `Changed per-record ${key}`);
    for (const key of ["facts", "citations", "status", "uplift"]) assert.deepEqual(record.resultLedger[key], original.resultLedger[key], `Changed per-record ${key}`);
  }
  const sort = (rows) => [...rows].sort((a, b) => a.condition.localeCompare(b.condition));
  assert.deepEqual(sort(aggregateRecords(records)), sort(aggregateRecords(raw)), "Sanitization changed a leaderboard metric");
  assert.deepEqual(rankSummaries(aggregateRecords(records)), rankSummaries(aggregateRecords(raw)), "Sanitization changed ranking");
  const generatedAt = new Date().toISOString();
  const document = { schemaVersion: 1, release: "v12-public-1", suiteId: SUITE_ID, generatedAt, boundaries: PUBLIC_BOUNDARIES, records };
  const leaderboard = publicLeaderboard(records, generatedAt);
  const content = {
    "results.json": json(document), "leaderboard.json": json(leaderboard),
    "leaderboard.html": renderPublicHtml(document, leaderboard),
    "process-monitoring.html": renderPublicHtml(document, leaderboard, "monitoring"),
  };
  // Only generated allowlisted public data reaches these writes; source files are read-only.
  mkdirSync(out, { recursive: true });
  for (const [name, body] of Object.entries(content)) writeFileSync(join(out, name), body, "utf8");
  writeFileSync(join(out, "manifest.json"), json({
    schemaVersion: 1, suiteId: SUITE_ID, generatedAt, recordCount: records.length,
    files: Object.fromEntries(Object.entries(content).map(([name, body]) => [name, { bytes: Buffer.byteLength(body), sha256: digest(body) }])),
  }), "utf8");
  console.log(JSON.stringify({ ...verify(out), output: out, rankingPreserved: true }, null, 2));
}
