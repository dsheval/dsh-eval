const RANKABLE = new Set(["PASS", "PARTIAL", "FAIL", "RETRIEVAL_FAIL"]);

export function scoreTask({ task, answer = "", processLedger, judge, systemError = null, thresholds }) {
  const result = emptyResult();
  result.metrics = deriveMetrics(processLedger, judge);
  if (systemError) return finish(result, "SYSTEM_ERROR", String(systemError));
  if (!String(answer).trim()) return finish(result, "SYSTEM_ERROR", "没有产生回答");

  const retrievalCalls = processLedger.tools.searchCalls + processLedger.tools.fetchCalls;
  if (retrievalCalls < thresholds.minimumRetrievalCalls) return finish(result, "RETRIEVAL_FAIL", "未观察到合格的搜索或抓取调用");
  if (processLedger.sources.retrievedUrls.length < thresholds.minimumRetrievedUrls) return finish(result, "RETRIEVAL_FAIL", "工具轨迹未产生可审计 URL");
  if (!judge) return finish(result, "GRADER_ERROR", "正式评分缺少 Judge 结果");
  if (!judge.ok) return finish(result, "GRADER_ERROR", `Judge 失败: ${judge.code}`);

  const verdict = judge.verdict;
  result.judgeStatus = verdict.status;
  result.reasons.push(...(verdict.reasons ?? []));
  if (verdict.fabricatedCitations > 0) return finish(result, "FAIL", "Judge 确认存在捏造引用");

  const hardChecks = {
    openUrls: processLedger.sources.retrievedOpenUrls >= thresholds.minimumOpenUrls,
    toolSuccess: (processLedger.tools.successRate ?? 0) >= thresholds.minimumToolSuccessRate,
    structured: (processLedger.results.structuredCompleteness ?? 0) >= thresholds.minimumStructuredCompleteness,
    claimSupport: (verdict.claimSupport ?? 0) >= thresholds.minimumClaimSupport,
    citationCorrectness: (verdict.citationCorrectness ?? 0) / 4 >= thresholds.minimumCitationCorrectness,
    citationUrlIntegrity: processLedger.sources.suspiciousAnswerUrls.length === 0,
  };
  result.gates = hardChecks;
  const passed = Object.values(hardChecks).filter(Boolean).length;
  if (passed === Object.keys(hardChecks).length && verdict.status === "PASS") return finish(result, "PASS");
  if (passed >= 4 && verdict.status !== "FAIL") return finish(result, "PARTIAL", "部分检索/证据门槛未达到");
  return finish(result, "FAIL", "检索或证据质量未达到最低门槛");
}

export function deriveMetrics(processLedger, judge) {
  const verdict = judge?.ok ? judge.verdict : {};
  return {
    retrievalActivation: Number(processLedger.tools.searchCalls + processLedger.tools.fetchCalls > 0),
    toolSuccessRate: processLedger.tools.successRate,
    structuredCompleteness: processLedger.results.structuredCompleteness,
    retrievedUrls: processLedger.sources.retrievedUrls.length,
    uniqueDomains: processLedger.sources.uniqueDomains,
    urlValidity: processLedger.sources.urlValidity,
    citationCorrectness: verdict.citationCorrectness == null ? null : verdict.citationCorrectness / 4,
    citationCompleteness: verdict.citationCompleteness == null ? null : verdict.citationCompleteness / 4,
    claimSupport: verdict.claimSupport ?? null,
    sourceQuality: verdict.sourceQuality == null ? null : verdict.sourceQuality / 4,
    primarySourceRatio: verdict.primarySourceRatio ?? null,
    providerCount: processLedger.providers?.length ?? 0,
    unsupportedClaims: verdict.unsupportedClaims ?? null,
    fabricatedCitations: verdict.fabricatedCitations ?? null,
    fallbacks: processLedger.resilience.fallbacks,
    fallbackRecovery: processLedger.resilience.fallbacks > 0 ? Number((processLedger.tools.successfulResults ?? 0) > 0) : null,
    errors: processLedger.resilience.errors,
    timeouts: processLedger.resilience.timeouts,
    latencyMs: processLedger.resources.latencyMs,
    searchCalls: processLedger.tools.searchCalls,
    fetchCalls: processLedger.tools.fetchCalls,
  };
}

export function comparePaired(plugin, baseline, delta = 0.05) {
  if (!plugin || !baseline || !RANKABLE.has(plugin.status) || !RANKABLE.has(baseline.status)) return "NOT_COMPARABLE";
  const riskPlugin = plugin.metrics.fabricatedCitations ?? 0;
  const riskBaseline = baseline.metrics.fabricatedCitations ?? 0;
  if (riskPlugin !== riskBaseline) return riskPlugin < riskBaseline ? "WIN" : "LOSS";
  const dimensions = ["claimSupport", "citationCorrectness", "citationCompleteness", "sourceQuality", "urlValidity", "toolSuccessRate", "structuredCompleteness"];
  let wins = 0;
  let losses = 0;
  for (const key of dimensions) {
    const left = plugin.metrics[key];
    const right = baseline.metrics[key];
    if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
    if (left - right >= delta) wins += 1;
    if (right - left >= delta) losses += 1;
  }
  if (wins >= losses + 2) return "WIN";
  if (losses >= wins + 2) return "LOSS";
  return "TIE";
}

export function comparable(record, baseline) {
  if (!record || !baseline) return false;
  return record.comparisonKey === baseline.comparisonKey && record.taskId === baseline.taskId && record.attempt === baseline.attempt;
}

export function emptyResult() {
  return { status: "NOT_SCORED", judgeStatus: null, gates: {}, metrics: {}, pairedVsC0: "NOT_COMPARABLE", reasons: [] };
}

function finish(result, status, reason = null) {
  result.status = status;
  if (reason) result.reasons.push(reason);
  return result;
}
