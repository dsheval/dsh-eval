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
  assert.equal(result.text.includes("secret"), false);
  assert.equal(result.items.some((item) => item.path === "binary.bin" && !item.readable), true);
});
