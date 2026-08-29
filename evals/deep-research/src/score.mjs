import { emptyResultLedger, normalizeText, ratio } from "./lib.mjs";

const ABSTAIN_RE = /没有找到|未找到|查无|信息不足|证据不足|无法确认|无法核验|不足以判断|not found|insufficient evidence/i;
const OUT_OF_SCOPE_RE = /超出.{0,8}(?:范围|能力)|不适用于|能力边界|out of scope/i;
const CONFLICT_RE = /冲突|矛盾|口径不同|统计口径|说法不一|来源差异|不可直接比较/i;

export function scoreTask(input) {
  const { task, answer = "", processLedger, judge = null, systemError = null } = input;
  if (task.mode === "derived") throw new Error("派生题必须使用 deriveTaskRecord");
  const result = emptyResultLedger();
  result.citations = citationSummary(processLedger);
  result.deliverables = scoreDeliverables(task, answer);
  result.risks.forbiddenContent = matchForbidden(task, answer);

  if (systemError) {
    result.status = "SYSTEM_ERROR";
    result.reasons.push(String(systemError));
    return result;
  }
  if (!String(answer).trim()) {
    result.status = "SYSTEM_ERROR";
    result.reasons.push("没有产生可评分回答");
    return result;
  }
  if (OUT_OF_SCOPE_RE.test(answer)) {
    result.status = "OUT_OF_SCOPE";
    result.reasons.push("插件明确声明能力边界");
    return result;
  }

  if (task.mode === "interrupt") return scoreRecovery(result, answer, processLedger);
  if (task.track === "SF") return scoreShortFact(result, task, answer, processLedger);
  if (task.track === "LF") return scoreLongForm(result, task, answer, judge);
  result.status = "NOT_SCORED";
  result.reasons.push("未知题型");
  return result;
}

function scoreShortFact(result, task, answer, processLedger) {
  const retrievalCalls = processLedger.tools.searchCalls + processLedger.tools.fetchCalls;
  const requiredRetrievalCalls = task.minSearchCalls ?? (task.requiresRetrieval ? 1 : 0);
  const searched = retrievalCalls >= requiredRetrievalCalls;
  if (!searched) {
    result.reasons.push(`检索或抓取事件不足：观察到 ${retrievalCalls}，要求至少 ${requiredRetrievalCalls}`);
  }

  if (task.expectedBehavior === "ABSTAIN") {
    const abstained = ABSTAIN_RE.test(answer);
    result.facts = { correct: abstained ? 1 : 0, wrong: abstained ? 0 : 1, missing: 0 };
    result.researchCompletion = abstained ? "COMPLETE" : "INCOMPLETE";
    result.status = abstained && searched ? "PASS" : "FAIL";
    if (!abstained) result.reasons.push("应说明证据不足，但回答没有可靠拒答");
    return result;
  }

  if (task.expectedBehavior === "REPORT_CONFLICT") {
    const conflict = CONFLICT_RE.test(answer);
    const cited = result.citations.open > 0;
    result.facts = { correct: conflict && cited ? 1 : 0, wrong: conflict && cited ? 0 : 1, missing: 0 };
    result.risks.conflictHandling = conflict ? "PASS" : "FAIL";
    result.researchCompletion = conflict && cited ? "COMPLETE" : "INCOMPLETE";
    result.status = conflict && cited && searched ? "PASS" : "FAIL";
    if (!conflict) result.reasons.push("没有呈现来源或口径冲突");
    if (!cited) result.reasons.push("没有留下已验证可打开的来源");
    return result;
  }

  const gold = task.gold ?? [];
  if (!gold.length) {
    result.status = "NOT_SCORED";
    result.reasons.push("短事实 gold 未配置");
    return result;
  }
  const normalizedAnswer = normalizeText(answer);
  const matched = gold.some((value) => normalizedAnswer.includes(normalizeText(value)));
  result.facts = { correct: matched ? 1 : 0, wrong: matched ? 0 : 1, missing: 0 };
  result.researchCompletion = matched && searched ? "COMPLETE" : "INCOMPLETE";
  if (matched && task.requiresRetrieval && !searched) {
    result.status = "NOT_SCORED";
    result.reasons.push("闭卷命中：题目需要替换，不计插件质量");
  } else {
    result.status = matched ? "PASS" : "FAIL";
    if (!matched) result.reasons.push("最终答案未命中私有 gold");
  }
  return result;
}

function scoreLongForm(result, task, answer, judge) {
  const critical = result.deliverables.checks.filter((check) => check.critical);
  const criticalMet = critical.filter((check) => check.met).length;
  const minimumUrlsMet = result.citations.open >= (task.minOpenUrls ?? 0);
  const hasForbidden = result.risks.forbiddenContent.length > 0;
  const deterministic =
    criticalMet === critical.length && minimumUrlsMet && !hasForbidden
      ? "PASS"
      : result.deliverables.met > 0 && result.citations.total > 0
        ? "PARTIAL"
        : "FAIL";
  result.deterministicStatus = deterministic;
  result.researchCompletion =
    deterministic === "PASS"
      ? "COMPLETE"
      : result.citations.total > 0 && result.deliverables.completeness < 0.5
        ? "SEARCH_ONLY"
        : "INCOMPLETE";

  if (!judge) {
    result.status = task.judgeRequired ? "NOT_SCORED" : deterministic;
    if (task.judgeRequired) result.reasons.push("长文需要 LLM Judge，本轮未调用 Judge");
    return result;
  }
  if (!judge.ok) {
    result.status = "GRADER_ERROR";
    result.reasons.push(`Judge 失败: ${judge.code ?? "unknown"}`);
    return result;
  }

  const verdict = judge.verdict;
  result.status = verdict.status;
  result.facts = {
    correct: null,
    wrong: null,
    missing: null,
    score: verdict.factualCorrectness,
  };
  result.citations.faithful = verdict.citationFaithfulness == null ? null : verdict.citationFaithfulness / 4;
  result.citations.keyClaimCoverage = verdict.keyClaimCoverage;
  result.researchCompletion = verdict.researchCompletion;
  result.risks.fabricatedFacts = verdict.fabricatedFacts;
  result.risks.fabricatedCitations = verdict.fabricatedCitations;
  result.risks.conflictHandling = verdict.conflictHandling;
  result.reasons.push(...(verdict.reasons ?? []));

  if ((verdict.fabricatedCitations ?? 0) > 0) {
    result.status = "FAIL";
    result.reasons.push("发现编造引用，触发质量失败");
  } else if (result.status === "PASS" && deterministic !== "PASS") {
    result.status = deterministic === "FAIL" ? "FAIL" : "PARTIAL";
    result.reasons.push("Judge PASS 被确定性交付物或 URL 门槛降级");
  }
  if (hasForbidden) {
    result.status = "FAIL";
    result.reasons.push("出现题面禁止内容");
  }
  return result;
}

function scoreRecovery(result, answer, processLedger) {
  const recovery = processLedger.recovery;
  const claimsContinuation = /继续|恢复|中断|上次|已有进度|checkpoint|resume/i.test(answer);
  const passed =
    recovery.interrupted === true &&
    recovery.resumed === true &&
    recovery.checkpointVisible === true &&
    recovery.restartedFromBeginning !== true &&
    claimsContinuation;
  result.status = passed ? "PASS" : "FAIL";
  result.recovery = passed ? "PASS" : "FAIL";
  result.researchCompletion = passed ? "COMPLETE" : "INCOMPLETE";
  if (!passed) result.reasons.push("未能证明从有效中间状态继续");
  return result;
}

export function deriveTaskRecord(task, sourceRecord) {
  const result = emptyResultLedger();
  if (!sourceRecord) {
    result.status = "SYSTEM_ERROR";
    result.reasons.push(`缺少派生来源 ${task.deriveFrom}`);
    return result;
  }
  const source = sourceRecord.resultLedger;
  result.status = source.researchCompletion === "COMPLETE" ? "PASS" : "FAIL";
  result.researchCompletion = source.researchCompletion;
  result.deliverables = structuredClone(source.deliverables);
  result.citations = structuredClone(source.citations);
  result.risks = structuredClone(source.risks);
  result.reasons.push(
    source.researchCompletion === "COMPLETE"
      ? "来源任务完成研究交付物"
      : source.researchCompletion === "SEARCH_ONLY"
        ? "来源任务只有搜索结果，未完成研究"
        : "来源任务研究未完成",
  );
  return result;
}

export function compareWithBaseline(pluginResult, baselineResult) {
  if (!pluginResult || !baselineResult) return "NOT_COMPARABLE";
  const rank = { FAIL: 0, PARTIAL: 1, PASS: 2 };
  if (!(pluginResult.status in rank) || !(baselineResult.status in rank)) return "NOT_COMPARABLE";
  if (rank[pluginResult.status] > rank[baselineResult.status]) return "POSITIVE";
  if (rank[pluginResult.status] < rank[baselineResult.status]) return "NEGATIVE";
  const pluginRisk = (pluginResult.risks.fabricatedFacts ?? 0) + (pluginResult.risks.fabricatedCitations ?? 0);
  const baselineRisk = (baselineResult.risks.fabricatedFacts ?? 0) + (baselineResult.risks.fabricatedCitations ?? 0);
  if (pluginRisk < baselineRisk) return "POSITIVE";
  if (pluginRisk > baselineRisk) return "NEGATIVE";
  const pluginCoverage = pluginResult.citations.keyClaimCoverage ?? pluginResult.deliverables.completeness ?? 0;
  const baselineCoverage = baselineResult.citations.keyClaimCoverage ?? baselineResult.deliverables.completeness ?? 0;
  if (pluginCoverage - baselineCoverage >= 0.2) return "POSITIVE";
  if (baselineCoverage - pluginCoverage >= 0.2) return "NEGATIVE";
  return "NO_CLEAR";
}

function scoreDeliverables(task, answer) {
  const checks = (task.deliverables ?? []).map((deliverable) => ({
    id: deliverable.id,
    label: deliverable.label,
    critical: deliverable.critical !== false,
    met: (deliverable.patterns ?? []).every((pattern) => new RegExp(pattern, "iu").test(answer)),
  }));
  const met = checks.filter((check) => check.met).length;
  return {
    required: checks.length,
    met,
    completeness: ratio(met, checks.length),
    checks,
  };
}

function citationSummary(processLedger) {
  const total = processLedger.sources.answerUrls?.length ?? processLedger.sources.totalUrls ?? 0;
  const open = processLedger.sources.answerOpenUrls ?? processLedger.sources.openUrls ?? 0;
  const checked = processLedger.sources.answerCheckedUrls ?? processLedger.sources.checkedUrls ?? 0;
  return {
    total,
    open,
    validity: ratio(open, checked),
    faithful: null,
    keyClaimCoverage: null,
  };
}

function matchForbidden(task, answer) {
  return (task.forbiddenPatterns ?? []).filter((pattern) => new RegExp(pattern, "iu").test(answer));
}
