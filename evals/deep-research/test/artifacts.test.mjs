import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { collectWorkspaceArtifacts } from "../src/artifacts.mjs";

test("只读取隔离工作区内的受支持文本产物", () => {
  const root = mkdtempSync(join(tmpdir(), "research-artifacts-"));
  mkdirSync(join(root, "reports"));
  writeFileSync(join(root, "reports", "REPORT.md"), "报告 https://example.com/a");
  writeFileSync(join(root, "binary.bin"), Buffer.from([0, 1, 2]));
  const outside = join(root, "..", `outside-${Date.now()}.md`);
  writeFileSync(outside, "secret");
  try {
    symlinkSync(outside, join(root, "outside-link.md"));
  } catch {
    // Symlink creation can be unavailable on locked-down Windows hosts.
  }
  const result = collectWorkspaceArtifacts(root);
  assert.equal(result.items.some((item) => item.path === "reports/REPORT.md" && item.textIncluded), true);
  assert.equal(result.text.includes("https://example.com/a"), true);
  assert.equal(result.scoringText.includes("https://example.com/a"), true);
  assert.equal(result.text.includes("secret"), false);
  assert.equal(result.items.some((item) => item.path === "binary.bin" && !item.readable), true);
});

test("Judge 只接收最终报告，不接收证据计划和原始来源", () => {
  const root = mkdtempSync(join(tmpdir(), "research-artifact-scoring-"));
  writeFileSync(join(root, "evidence-plan.md"), "EVIDENCE ONLY");
  writeFileSync(join(root, "raw-source.html"), "RAW SOURCE");
  writeFileSync(join(root, "final-report.md"), "FINAL REPORT");
  const result = collectWorkspaceArtifacts(root);
  assert.equal(result.text.includes("EVIDENCE ONLY"), true);
  assert.equal(result.scoringText.includes("EVIDENCE ONLY"), false);
  assert.equal(result.scoringText.includes("RAW SOURCE"), false);
  assert.equal(result.scoringText.includes("FINAL REPORT"), true);
});

test("文件很多时优先采集最终报告而不是原始网页", () => {
  const root = mkdtempSync(join(tmpdir(), "research-artifact-priority-"));
  for (let index = 0; index < 60; index += 1) {
    writeFileSync(join(root, `source-${String(index).padStart(2, "0")}.html`), `<p>source ${index}</p>`);
  }
  writeFileSync(join(root, "final-report.md"), "FINAL DELIVERABLE");
  const result = collectWorkspaceArtifacts(root, { maxFiles: 10 });
  assert.equal(result.items[0].path, "final-report.md");
  assert.equal(result.text.includes("FINAL DELIVERABLE"), true);
  assert.equal(result.truncated, true);
});
