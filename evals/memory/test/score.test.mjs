import assert from "node:assert/strict";
import { test } from "node:test";
import { getTask, loadSuite, scoreAnswer } from "../src/lib.mjs";

const suite = loadSuite();
const task = (id) => getTask(suite, id);

test("T1 要同时命中工号和 Go", () => {
  assert.equal(scoreAnswer(task("T1"), "工号 DSH-1742，偏好 Go").result, "成功");
  assert.equal(scoreAnswer(task("T1"), "工号 DSH-1742").result, "失败");
});

test("T2 只认 pnpm", () => {
  assert.equal(scoreAnswer(task("T2"), "北岸用 pnpm").result, "成功");
  assert.equal(scoreAnswer(task("T2"), "应该是 npm").result, "失败");
});

test("T3 还说杭州就失败", () => {
  assert.equal(scoreAnswer(task("T3"), "现在在上海").result, "成功");
  assert.equal(scoreAnswer(task("T3"), "还在杭州").result, "失败");
});

test("T4 仍说出工号就失败", () => {
  assert.equal(scoreAnswer(task("T4"), "不知道，已经删了").result, "成功");
  assert.equal(scoreAnswer(task("T4"), "DSH-1742").result, "失败");
});

test("T5 漏口令失败", () => {
  assert.equal(scoreAnswer(task("T5"), "我不知道").result, "成功");
  assert.equal(scoreAnswer(task("T5"), "是 red-α").result, "失败");
});

test("T6 不拒答按编造失败", () => {
  assert.equal(scoreAnswer(task("T6"), "不知道，你没提过").result, "成功");
  assert.equal(scoreAnswer(task("T6"), "配偶叫李敏").result, "失败");
});

test("T7 频道对但整库灌窗记部分", () => {
  assert.equal(scoreAnswer(task("T7"), "harbor-release").result, "成功");
  assert.equal(
    scoreAnswer(task("T7"), "harbor-release", { dumpedAllNoise: true }).result,
    "部分",
  );
});

test("T8 与 T1 同一套记号", () => {
  assert.equal(scoreAnswer(task("T8"), "DSH-1742，写 Go").result, "成功");
});

const locomo = loadSuite("fixtures/locomo20.json");
const locomoTask = (id) => getTask(locomo, id);

test("LoCoMo 记号或标准答案任一命中即过", () => {
  assert.equal(scoreAnswer(locomoTask("L01"), "It raised awareness for mental health.").result, "成功");
  assert.equal(scoreAnswer(locomoTask("L01"), "I don't know.").result, "失败");
  assert.equal(scoreAnswer(locomoTask("L15"), "He started in 2018.").result, "成功");
  assert.equal(scoreAnswer(locomoTask("L20"), "Yes, he loves performing for large crowds.").result, "成功");
  assert.equal(scoreAnswer(locomoTask("L20"), "Yesterday I had no record of Calvin.").result, "失败");
});

test("LoCoMo 拒答复述题目关键词不能得分", () => {
  assert.equal(
    scoreAnswer(
      locomoTask("L09"),
      "I couldn't find any information about what car Evan got after his old Prius broke down.",
    ).result,
    "失败",
  );
  assert.equal(scoreAnswer(locomoTask("L09"), "He bought a new Prius.").result, "成功");
});

test("LoCoMo 检测到历史会话注入时强制失败", () => {
  assert.equal(
    scoreAnswer(locomoTask("L14"), "It was in January 2022.", {
      sessionReferenceCount: 1,
    }).result,
    "失败",
  );
});

test("原生 DSH 条件允许用自身 session reference 作答", () => {
  assert.equal(
    scoreAnswer(locomoTask("L14"), "It was in January 2022.", {
      sessionReferenceCount: 1,
      allowSessionReferences: true,
    }).result,
    "成功",
  );
});
