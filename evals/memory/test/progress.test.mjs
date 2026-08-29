import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadCatalog } from "../src/catalog.mjs";
import { loadSuite } from "../src/lib.mjs";
import {
  findBaselineRun,
  isScored,
  listRunIds,
  openRun,
  pendingTasks,
  summarizeRun,
  writeJson,
  writeProgress,
} from "../src/progress.mjs";

const catalog = loadCatalog();
const suite = loadSuite();
const t1 = suite.tasks.filter((item) => item.id === "T1");

test("没打分的题才续跑", () => {
  assert.equal(isScored({ answerResult: "成功" }), true);
  assert.equal(isScored({ answerResult: "失败" }), true);
  assert.equal(isScored({ answerResult: "部分" }), true);
  assert.equal(isScored({ answerResult: null }), false);
  const pending = pendingTasks(suite.tasks, {
    T1: { answerResult: "失败" },
    T2: { answerResult: null },
  });
  assert.deepEqual(
    pending.map((item) => item.id),
    ["T2", "T3", "T4", "T5", "T6", "T7", "T8"],
  );
});

test("openRun 续跑跳过已打分题，fresh 重开", () => {
  const home = mkdtempSync(join(tmpdir(), "memory-eval-"));
  const recordsDir = join(home, "records");
  const target = catalog.baseline;
  const first = openRun({
    recordsRoot: recordsDir,
    target,
    suite,
    catalog,
    profile: "memory-eval",
    tester: "smoke",
    tasks: t1,
  });
  first.records.T1.answerResult = "失败";
  first.records.T1.answerReason = "没有回答";
  writeJson(join(first.dir, "T1.json"), first.records.T1);
  writeProgress(first.dir, { status: "done", step: "T1", message: "T1 失败" }, { log: false });

  const resumed = openRun({
    recordsRoot: recordsDir,
    target,
    suite,
    catalog,
    profile: "memory-eval",
    tester: "实测",
    tasks: t1,
  });
  assert.equal(resumed.runId, first.runId);
  assert.equal(resumed.pending.length, 0);
  assert.equal(resumed.meta.tester, "实测");
  assert.equal(resumed.records.T1.answerResult, "失败");

  const fresh = openRun({
    recordsRoot: recordsDir,
    target,
    suite,
    catalog,
    profile: "memory-eval",
    tester: "实测",
    tasks: t1,
    fresh: true,
  });
  assert.equal(fresh.pending[0].id, "T1");
  assert.equal(fresh.records.T1.answerResult, null);
  assert.deepEqual(listRunIds(home), [first.runId]);
});

test("rerun-scored 只清空 --tasks 选中的已评分题，不改同 run 其他题", () => {
  const home = mkdtempSync(join(tmpdir(), "memory-eval-rerun-"));
  const recordsDir = join(home, "records");
  const target = catalog.baseline;
  const selected = suite.tasks.filter((task) => task.id === "T1" || task.id === "T4");
  const first = openRun({
    recordsRoot: recordsDir,
    target,
    suite,
    catalog,
    profile: "memory-eval",
    tester: "首次",
    tasks: selected,
  });

  first.records.T1.answer = "旧失败答案";
  first.records.T1.answerResult = "失败";
  first.records.T1.answerReason = "handler failure";
  writeJson(join(first.dir, "T1.json"), first.records.T1);

  first.records.T2.answer = "不得改写";
  first.records.T2.answerResult = "成功";
  first.records.T2.answerReason = "旧成绩";
  const untouchedPath = join(first.dir, "T2.json");
  const untouchedText = `${JSON.stringify(first.records.T2)}\n`;
  writeFileSync(untouchedPath, untouchedText);

  first.records.T4.answer = "尚未评分的半成品";
  writeJson(join(first.dir, "T4.json"), first.records.T4);

  const rerun = openRun({
    recordsRoot: recordsDir,
    target,
    suite,
    catalog,
    profile: "memory-eval",
    tester: "补跑",
    tasks: selected,
    rerunScored: true,
  });

  assert.deepEqual(rerun.pending.map((task) => task.id), ["T1", "T4"]);
  assert.equal(rerun.records.T1.answer, "");
  assert.equal(rerun.records.T1.answerResult, null);
  assert.equal(rerun.records.T1.answerReason, null);
  assert.equal(rerun.records.T4.answer, "尚未评分的半成品");
  assert.equal(rerun.records.T4.answerResult, null);
  assert.equal(rerun.records.T2.answerResult, "成功");
  assert.equal(readFileSync(untouchedPath, "utf8"), untouchedText);

  assert.throws(
    () =>
      openRun({
        recordsRoot: recordsDir,
        target,
        suite,
        catalog,
        profile: "memory-eval",
        tester: "冲突参数",
        tasks: selected,
        fresh: true,
        rerunScored: true,
      }),
    /不能同时使用/,
  );
});

test("locomo20 的 runId 带后缀，并落 L01.json", () => {
  const home = mkdtempSync(join(tmpdir(), "memory-eval-"));
  const locomo = loadSuite("fixtures/locomo20.json");
  const opened = openRun({
    recordsRoot: join(home, "records"),
    target: catalog.baseline,
    suite: locomo,
    catalog,
    profile: "memory-eval",
    tester: "实测",
    tasks: locomo.tasks.slice(0, 1),
  });
  assert.match(opened.runId, /C0-none-passive-locomo20$/);
  assert.equal(opened.pending[0].id, "L01");
  assert.equal(opened.records.L01.answerResult, null);
});

test("summary 对同套题的 C0 算过程增量", () => {
  const home = mkdtempSync(join(tmpdir(), "memory-eval-"));
  const recordsDir = join(home, "records");
  const locomo = loadSuite("fixtures/locomo20.json");
  const c0 = openRun({
    recordsRoot: recordsDir,
    target: catalog.baseline,
    suite: locomo,
    catalog,
    profile: "memory-eval",
    tester: "实测",
    tasks: locomo.tasks.slice(0, 1),
  });
  c0.records.L01.answerResult = "失败";
  c0.records.L01.answerReason = "未命中标准答案或记号";
  c0.records.L01.process.injectedTokens = 21000;
  writeJson(join(c0.dir, "L01.json"), c0.records.L01);

  const plugin = openRun({
    recordsRoot: recordsDir,
    target: catalog.plugins[0],
    suite: locomo,
    catalog,
    profile: "memory-eval",
    tester: "实测",
    tasks: locomo.tasks.slice(0, 1),
  });
  plugin.records.L01.answerResult = "成功";
  plugin.records.L01.answerReason = "命中标准答案";
  plugin.records.L01.process.injectedTokens = 24000;
  plugin.records.L01.process.seedEchoCount = 1;
  plugin.records.L01.process.seedCount = 1;
  writeJson(join(plugin.dir, "L01.json"), plugin.records.L01);
  writeJson(join(plugin.dir, "meta.json"), { ...plugin.meta, condition: "P1", suiteId: locomo.id });

  assert.equal(findBaselineRun(plugin.dir).meta.condition, "C0");
  const summary = summarizeRun(plugin.dir);
  assert.match(summary.tasks[0], /\+3000/);
  assert.match(summary.tasks[0], /echo 1\/1/);
});
