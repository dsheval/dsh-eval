import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { resetWorkspace, workspaceKeepRels } from "../src/workspace-reset.mjs";

test("题间清盘只留标记，追问前能保住插件库", () => {
  const root = mkdtempSync(join(tmpdir(), "ws-reset-"));
  writeFileSync(join(root, ".eval-workspace"), "a\n");
  mkdirSync(join(root, "memory"));
  writeFileSync(join(root, "memory", "john.md"), "education");
  writeFileSync(join(root, "project-context.md"), "harbor-release");
  writeFileSync(join(root, "MEMORY.md"), "plugin-store");

  resetWorkspace(root, { marker: "a\n" });
  assert.equal(readFileSync(join(root, ".eval-workspace"), "utf8"), "a\n");
  assert.throws(() => readFileSync(join(root, "memory", "john.md")));
  assert.throws(() => readFileSync(join(root, "project-context.md")));
  assert.throws(() => readFileSync(join(root, "MEMORY.md")));

  mkdirSync(join(root, "memory"));
  writeFileSync(join(root, "memory", "john.md"), "education");
  writeFileSync(join(root, "MEMORY.md"), "plugin-store");
  resetWorkspace(root, { marker: "a\n", keepRelPaths: ["MEMORY.md"] });
  assert.equal(readFileSync(join(root, "MEMORY.md"), "utf8"), "plugin-store");
  assert.throws(() => readFileSync(join(root, "memory", "john.md")));
});

test("只保留工作区里的 wipe 路径", () => {
  const rels = workspaceKeepRels(
    { wipe: ["{workspace}/MEMORY.md", "{home}/mnemon"] },
    "D:/ws/a",
    {
      home: "D:/safe-home",
      profileDir: "D:/safe-home/profiles/memory-eval",
      workspaceA: "D:/ws/a",
      workspaceB: "D:/ws/b",
    },
  );
  assert.deepEqual(rels, ["MEMORY.md"]);
});
