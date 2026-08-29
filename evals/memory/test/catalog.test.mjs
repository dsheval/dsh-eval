import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  isMemoryPlugin,
  loadCatalog,
  resolveTargets,
  targetFromRanking,
} from "../src/catalog.mjs";
import { loadSuite } from "../src/lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const rankings = JSON.parse(readFileSync(join(here, "fixtures", "rankings-sample.json"), "utf8"));

test("suite 只留题，名录另放", () => {
  const suite = loadSuite();
  const catalog = loadCatalog();
  assert.equal(suite.conditions, undefined);
  assert.equal(suite.tasks.length, 8);
  assert.equal(catalog.baseline.id, "C0");
  assert.ok(catalog.plugins.length >= 8);
});

test("默认目标是 C0 加名录全部插件", () => {
  const catalog = loadCatalog();
  const targets = resolveTargets(catalog, {});
  assert.equal(targets[0].id, "C0");
  assert.equal(targets[0].add, null);
  assert.ok(targets.some((item) => item.plugin === "dsh-mnemon"));
});

test("按插件名筛选仍强制带上 C0", () => {
  const catalog = loadCatalog();
  const targets = resolveTargets(catalog, { plugins: ["mem9", "dsh-mnemon"] });
  assert.deepEqual(
    targets.map((item) => item.plugin),
    ["none", "mem9", "dsh-mnemon"],
  );
});

test("all-memory 排除 skill 和窗口插件，并套用名录 wipe", () => {
  const catalog = loadCatalog();
  assert.equal(isMemoryPlugin(rankings.rankings.total[0]), true);
  assert.equal(isMemoryPlugin(rankings.rankings.total[1]), false);
  assert.equal(isMemoryPlugin(rankings.rankings.total[2]), false);
  const targets = resolveTargets(catalog, { allMemory: true, rankings });
  assert.equal(targets[0].id, "C0");
  assert.ok(targets.some((item) => item.plugin === "mem9"));
  assert.ok(!targets.some((item) => item.plugin === "dsh-context"));
  const mnemon = targets.find((item) => item.plugin === "dsh-mnemon");
  assert.ok(mnemon.wipe.length > 0);
  assert.ok(mnemon.conflictsWith.includes("@mnemon-dev/dsh-mnemon"));
  const mem9 = targets.find((item) => item.plugin === "mem9");
  assert.deepEqual(mem9.requiredEnv, ["MEM9_API_KEY"]);
  const officialMnemon = targetFromRanking(
    { name: "mnemon", fullName: "mnemon-dev/mnemon", type: "cordis-plugin" },
    catalog,
  );
  assert.equal(officialMnemon.sourceInstallMode, "file");
});

test("总榜只能选择本地 allowlist，不能提供可执行安装项", () => {
  const catalog = loadCatalog();
  const mem9 = targetFromRanking(rankings.rankings.total[0], catalog);
  assert.equal(mem9.add, "@mem9/dsh-plugin@0.1.0");
  assert.equal(mem9.removeName, "@mem9/dsh-plugin");
  assert.deepEqual(mem9.requiredEnv, ["MEM9_API_KEY"]);

  const malicious = {
    name: "unreviewed-memory",
    fullName: "attacker/unreviewed-memory",
    description: "memory",
    type: "cordis-plugin",
    install: { commands: ["dsh plugin add attacker-package"] },
  };
  assert.equal(targetFromRanking(malicious, catalog), null);
  const targets = resolveTargets(catalog, {
    allMemory: true,
    rankings: { rankings: { total: [malicious] } },
  });
  assert.deepEqual(targets.map((item) => item.id), ["C0"]);
});

test("所有可执行插件安装源都固定版本并带完整性校验", () => {
  const catalog = loadCatalog();
  for (const target of catalog.plugins) {
    if (target.sourceArchive) {
      assert.match(target.sourceRef, /^[0-9a-f]{40}$/i, target.id);
      assert.match(target.sourceArchiveSha256, /^[A-F0-9]{64}$/i, target.id);
      continue;
    }
    assert.match(target.add, /(?:@[0-9]|[0-9a-f]{40})/, target.id);
    assert.match(target.packageTarball, /^https:\/\//, target.id);
    assert.match(target.packageIntegrity, /^sha(256|384|512)-/, target.id);
  }
});

test("Mnemon 使用固定源码版本和隔离数据目录覆盖", () => {
  const catalog = loadCatalog();
  const mnemon = catalog.plugins.find((item) => item.id === "P3");
  assert.match(mnemon.sourceRef, /^[0-9a-f]{40}$/);
  assert.equal(
    mnemon.sourceArchive,
    `https://codeload.github.com/mnemon-dev/mnemon/zip/${mnemon.sourceRef}`,
  );
  assert.match(mnemon.sourceArchiveSha256, /^[A-F0-9]{64}$/);
  assert.equal(mnemon.sourceInstallMode, "file");
  assert.equal(mnemon.env.MNEMON_DATA_DIR, "{targetHome}/mnemon");
  assert.deepEqual(mnemon.patches, ["fixtures/patches/mnemon-isolated.patch.yml"]);
  assert.deepEqual(mnemon.wipe, ["{home}/mnemon"]);
});

test("Memory Evolve 固定到预构建源码归档", () => {
  const catalog = loadCatalog();
  const target = catalog.plugins.find((item) => item.id === "P4");
  assert.equal(target.plugin, "dsh-memory-evolve");
  assert.match(target.add, /^https:\/\/codeload\.github\.com\/csyangwen\/dsh-memory-evolve\/tar\.gz\/[0-9a-f]{40}$/);
  assert.ok(target.add.endsWith(target.sourceRef));
  assert.equal(target.removeName, "dsh-memory-evolve");
});

test("Causal Memory 固定源码快照并使用可迁移工具路径", () => {
  const catalog = loadCatalog();
  const target = catalog.plugins.find((item) => item.id === "P8");
  assert.equal(target.plugin, "causal-memory");
  assert.match(target.sourceArchive, /^https:\/\/codeload\.github\.com\/JingxuanC\/causal-memory\/zip\//);
  assert.match(target.sourceArchiveSha256, /^[A-F0-9]{64}$/);
  assert.equal(target.env.CAUSAL_MEMORY_BIN.startsWith("{baseHome}/"), true);
  assert.equal(target.compatTextOutput, true);
});
