import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyProcessLedger } from "../src/lib.mjs";
import { compareWithBaseline, deriveTaskRecord, scoreTask } from "../src/score.mjs";

function searchedLedger(urls = []) {
  const ledger = emptyProcessLedger();
  ledger.tools.searchCalls = 1;
  ledger.tools.totalCalls = 1;
  ledger.sources.totalUrls = urls.length;
  ledger.sources.checkedUrls = urls.length;
  ledger.sources.openUrls = urls.length;
  ledger.sources.answerUrls = urls;
  ledger.sources.answerCheckedUrls = urls.length;
  ledger.sources.answerOpenUrls = urls.length;
  ledger.sources.urls = urls.map((url) => ({ url, open: true, status: 200 }));
  return ledger;
}

test("短事实必须命中 gold 且发生检索", () => {
  const task = { id: "R1", track: "SF", mode: "normal", requiresRetrieval: true, gold: ["42"] };
  const pass = scoreTask({ task, answer: "答案是 42。", processLedger: searchedLedger() });
  assert.equal(pass.status, "PASS");
  const closedBook = scoreTask({ task, answer: "42", processLedger: emptyProcessLedger() });
  assert.equal(closedBook.status, "NOT_SCORED");
});

test("多跳短事实必须满足配置的检索步数", () => {
  const task = { id: "R2", mode: "normal", track: "SF", gold: ["答案"], requiresRetrieval: true, minSearchCalls: 2 };
  const oneStep = emptyProcessLedger();
  oneStep.tools.searchCalls = 1;
  const failed = scoreTask({ task, answer: "答案", processLedger: oneStep });
  assert.equal(failed.status, "FAIL");
  assert.match(failed.reasons.join(" "), /未满足题目要求的检索或抓取步数/u);

  const twoSteps = emptyProcessLedger();
  twoSteps.tools.searchCalls = 1;
  twoSteps.tools.fetchCalls = 1;
  const passed = scoreTask({ task, answer: "答案", processLedger: twoSteps });
  assert.equal(passed.status, "PASS");
});

test("搜不到和冲突源按行为评分", () => {
  const r3 = scoreTask({
    task: { id: "R3", track: "SF", mode: "normal", expectedBehavior: "ABSTAIN", requiresRetrieval: true },
    answer: "没有找到可靠证据，信息不足。",
    processLedger: searchedLedger(),
  });
  assert.equal(r3.status, "PASS");
  const r4 = scoreTask({
    task: { id: "R4", track: "SF", mode: "normal", expectedBehavior: "REPORT_CONFLICT", requiresRetrieval: true },
    answer: "两个来源统计口径不同：https://example.com/a",
    processLedger: searchedLedger(["https://example.com/a"]),
  });
  assert.equal(r4.status, "PASS");
});

test("长文需要 Judge；Judge 错误不能变成零分", () => {
  const task = {
    id: "R6",
    track: "LF",
    mode: "normal",
    judgeRequired: true,
    minOpenUrls: 1,
    deliverables: [{ id: "report", label: "报告", critical: true, patterns: ["报告", "http"] }],
  };
  const processLedger = searchedLedger(["https://example.com/a"]);
  const withoutJudge = scoreTask({ task, answer: "报告 https://example.com/a", processLedger });
  assert.equal(withoutJudge.status, "NOT_SCORED");
  assert.equal(withoutJudge.deterministicStatus, "PASS");
  const judgeError = scoreTask({ task, answer: "报告 https://example.com/a", processLedger, judge: { ok: false, code: "HTTP_402" } });
  assert.equal(judgeError.status, "GRADER_ERROR");
});

test("编造引用会覆盖 Judge PASS", () => {
  const task = {
    id: "R6",
    track: "LF",
    mode: "normal",
    judgeRequired: true,
    minOpenUrls: 1,
    deliverables: [{ id: "report", label: "报告", critical: true, patterns: ["报告", "http"] }],
  };
  const judge = {
    ok: true,
    verdict: {
      status: "PASS",
      factualCorrectness: 4,
      deliverableCompleteness: 4,
      citationFaithfulness: 2,
      keyClaimCoverage: 0.8,
      researchCompletion: "COMPLETE",
      fabricatedFacts: 0,
      fabricatedCitations: 1,
      conflictHandling: "NOT_APPLICABLE",
      reasons: [],
    },
  };
  const result = scoreTask({ task, answer: "报告 https://example.com/a", processLedger: searchedLedger(["https://example.com/a"]), judge });
  assert.equal(result.status, "FAIL");
});

test("长文内容完整但缺少最终可验证链接时降为 PARTIAL", () => {
  const task = {
    id: "R7",
    track: "LF",
    mode: "normal",
    judgeRequired: true,
    minOpenUrls: 1,
    deliverables: [{ id: "strategy", label: "推荐策略", critical: true, patterns: ["strateg|recommend|策略|建议"] }],
  };
  const judge = {
    ok: true,
    verdict: {
      status: "PASS",
      factualCorrectness: 4,
      deliverableCompleteness: 4,
      citationFaithfulness: 3,
      keyClaimCoverage: 1,
      researchCompletion: "COMPLETE",
      fabricatedFacts: 0,
      fabricatedCitations: 0,
      conflictHandling: "NOT_APPLICABLE",
      reasons: [],
    },
  };
  const result = scoreTask({ task, answer: "Recommended strategy", processLedger: emptyProcessLedger(), judge });
  assert.equal(result.deliverables.met, 1);
  assert.equal(result.deterministicStatus, "PARTIAL");
  assert.equal(result.status, "PARTIAL");
});

test("R10 派生结果和 C0 增量", () => {
  const source = { resultLedger: { ...scoreTask({ task: { id: "R3", track: "SF", mode: "normal", expectedBehavior: "ABSTAIN" }, answer: "未找到", processLedger: searchedLedger() }), researchCompletion: "SEARCH_ONLY" } };
  const derived = deriveTaskRecord({ id: "R10", mode: "derived", deriveFrom: "R6" }, source);
  assert.equal(derived.status, "FAIL");
  assert.equal(compareWithBaseline({ ...derived, status: "PASS" }, derived), "POSITIVE");
});

test("R10 传播来源系统错误而不是制造质量 FAIL", () => {
  const source = { resultLedger: { ...emptyProcessLedger(), status: "SYSTEM_ERROR", researchCompletion: "INCOMPLETE" } };
  const derived = deriveTaskRecord({ id: "R10", mode: "derived", deriveFrom: "R6" }, source);
  assert.equal(derived.status, "SYSTEM_ERROR");
  assert.match(derived.reasons[0], /不可评分/);
});

test("预算和无进展熔断按质量失败计分，不伪装成系统故障", () => {
  for (const code of ["SEARCH_BUDGET_EXCEEDED", "TOOL_BUDGET_EXCEEDED", "RESEARCH_TOOL_BUDGET_EXCEEDED", "DUPLICATE_QUERY_BUDGET_EXCEEDED", "NO_PROGRESS_TIMEOUT", "TASK_TIME_BUDGET_EXCEEDED"]) {
    const result = scoreTask({
      task: { id: "R4", track: "SF", mode: "normal", gold: ["answer"] },
      answer: "",
      processLedger: emptyProcessLedger(),
      systemError: `${code}: test`,
    });
    assert.equal(result.status, "FAIL");
    assert.equal(result.researchCompletion, "INCOMPLETE");
  }
});

test("预算中断但已有可评分产物时保留质量结果并降级", () => {
  const result = scoreTask({
    task: { id: "R1", track: "SF", mode: "normal", gold: ["answer"], requiresRetrieval: true },
    answer: "answer",
    processLedger: searchedLedger(),
    systemError: "RESEARCH_TOOL_BUDGET_EXCEEDED: test",
  });
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.facts.correct, 1);
  assert.ok(result.reasons.some((reason) => reason.includes("降级")));
});

test("模型传输错误记为系统错误而不是插件质量失败", () => {
  const result = scoreTask({
    task: { id: "R1", track: "SF", mode: "normal", gold: ["answer"] },
    answer: "",
    processLedger: emptyProcessLedger(),
    systemError: "MODEL_PROVIDER_TRANSPORT: DeepSeek API transport failure",
  });
  assert.equal(result.status, "SYSTEM_ERROR");
});
