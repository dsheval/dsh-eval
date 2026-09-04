import { createHash } from "node:crypto";
import { aggregateRecords, rankSummaries } from "./report.mjs";

export const SUITE_ID = "dsh-research-eval-v12-r3-refresh";
export const TASKS = ["R1", "R3", "R6", "R7", "R10"];
export const PLUGINS = Object.freeze({
  C0: "none", P1: "hanai-investment-dsh", P2: "dsh-science", P3: "dsh-scholar",
  P4: "dsh-deep-research", P5: "dsh-search-boost", P6: "dsh-deepresearch", P8: "dsh-science-workbench",
});
const TOOL_NAMES = new Set([
  "web_search", "bash", "read", "report", "todo_write", "subagent", "write", "edit", "grep",
  "send_message", "research_state", "research_init", "artifact_save", "create_goal", "research_hypothesis",
  "list_agents", "literature_search", "skill", "paper_resolve", "fused_search", "fetch_page", "job_list", "glob",
]);
const STATUSES = ["PASS", "PARTIAL", "FAIL", "SYSTEM_ERROR", "NOT_SCORED", "OUT_OF_SCOPE"];
const ERROR_CODES = [
  "SEARCH_BUDGET_EXCEEDED", "TOOL_BUDGET_EXCEEDED", "RESEARCH_TOOL_BUDGET_EXCEEDED",
  "DUPLICATE_QUERY_BUDGET_EXCEEDED", "NO_PROGRESS_TIMEOUT", "TASK_TIME_BUDGET_EXCEEDED",
  "MODEL_PROVIDER_TRANSPORT", "MODEL_PROVIDER_TIMEOUT", "MODEL_PROVIDER_SERVER", "MODEL_PROVIDER_RATE_LIMIT",
  "MODEL_PROVIDER_EMPTY_RESPONSE", "MODEL_PROVIDER_QUOTA", "MODEL_PROVIDER_WEB",
];
const EXTENSIONS = new Set([".md", ".txt", ".json", ".jsonl", ".csv", ".tsv", ".html", ".htm", ".py", ".js", ".mjs", ".sh", ".pdf", ".png", ".jpg", ".jpeg", ".svg", ".yaml", ".yml"]);
const metric = (v) => {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error("Invalid public numeric field");
  return v;
};
const flag = (v) => {
  if (v == null) return null;
  if (typeof v !== "boolean") throw new Error("Invalid public boolean field");
  return v;
};
const choice = (v, values) => {
  if (v == null) return null;
  if (!values.includes(v)) throw new Error("Unexpected public enum value");
  return v;
};
const numbers = (v, keys) => Object.fromEntries(keys.map((k) => [k, metric(v?.[k])]));
const booleans = (v, keys) => Object.fromEntries(keys.map((k) => [k, flag(v?.[k])]));
const isoDate = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) || !Number.isFinite(Date.parse(v))) throw new Error("Invalid public date");
  return v;
};
const codes = (items) => [...new Set((items ?? []).flatMap((s) => ERROR_CODES.filter((c) => typeof s === "string" && (s === c || s.startsWith(c + ":")))))];
const reference = (s) => typeof s === "string" ? createHash("sha256").update(s).digest("hex").slice(0, 24) : null;

// Construct a new object: never recursively copy arbitrary record fields or log text.
export function sanitizeRecord(r) {
  const condition = choice(r.condition, Object.keys(PLUGINS));
  if (!condition || r.plugin !== PLUGINS[condition]) throw new Error("Plugin identity does not match the frozen catalog");
  const taskId = choice(r.taskId, TASKS);
  if (!taskId || r.attempt !== 1) throw new Error("Unexpected V12 task/attempt");
  const p = r.processLedger ?? {}, result = r.resultLedger ?? {};
  if (p.environment?.suiteId !== SUITE_ID) throw new Error("Unexpected suite");
  const track = taskId === "R10" ? "PRODUCT" : ["R1", "R3"].includes(taskId) ? "SF" : "LF";
  const mode = taskId === "R10" ? "derived" : "normal";
  if (r.track !== track || r.mode !== mode) throw new Error("Task mode/track mismatch");
  const toolNames = {};
  for (const [name, count] of Object.entries(p.tools?.names ?? {})) {
    const publicName = TOOL_NAMES.has(name) ? name : "OTHER_TOOL";
    toolNames[publicName] = (toolNames[publicName] ?? 0) + metric(count);
  }
  const b = p.resources?.budget;
  const verdict = r.judge?.verdict;
  return {
    runId: `v12-${condition}-${taskId}-attempt-1`, condition, plugin: PLUGINS[condition], taskId, track, mode,
    attempt: 1, createdAt: isoDate(r.createdAt),
    provenance: {
      sourceReference: reference(r.provenance?.sourceRunId ?? r.runId),
      sourceSuiteId: choice(r.provenance?.sourceSuiteId ?? SUITE_ID, [SUITE_ID, "dsh-research-eval-v11-calibrated-protocol"]),
      reused: flag(r.provenance?.reused ?? false),
      method: choice(r.provenance?.method ?? "direct-run", ["validated-record-reuse", "fresh-task-refresh", "direct-run"]),
    },
    infrastructureAttempts: metric(r.infrastructureAttempts),
    discardedInfrastructureErrorCount: r.discardedInfrastructureErrors?.length ?? 0,
    discardedInfrastructureErrorCodes: codes(r.discardedInfrastructureErrors),
    processLedger: {
      environment: {
        suiteId: SUITE_ID, condition, plugin: PLUGINS[condition], taskId, attempt: 1,
        platform: choice(p.environment?.platform, ["linux", "win32", "darwin"]),
      },
      research: { ...booleans(p.research, ["planVisible", "subquestionsVisible"]), ...numbers(p.research, ["completedSteps"]) },
      tools: {
        ...numbers(p.tools, ["totalCalls", "budgetedCalls", "searchCalls", "fetchCalls", "analysisCalls", "writeCalls", "managementCalls", "fileCalls"]),
        queryStats: numbers(p.tools?.queryStats, ["total", "unique", "duplicate", "maxRepeat"]), names: toolNames,
      },
      sources: {
        ...numbers(p.sources, ["totalUrls", "checkedUrls", "openUrls", "uniqueDomains", "answerCheckedUrls", "answerOpenUrls", "firstPartyUrls"]),
        items: (p.sources?.urls ?? []).map((s, i) => ({
          id: `source-${i + 1}`, open: flag(s.open),
          status: Number.isInteger(s.status) && s.status >= 100 && s.status <= 599 ? s.status : null,
          retrieved: (p.sources.retrievedUrls ?? []).includes(s.url),
          citedInAnswer: (p.sources.answerUrls ?? []).includes(s.url),
        })),
      },
      anomalies: { ...numbers(p.anomalies, ["errors", "timeouts", "retries", "fallbacks", "manualInterventions"]), messageCount: p.anomalies?.messages?.length ?? 0 },
      recovery: booleans(p.recovery, ["interrupted", "resumed", "restartedFromBeginning", "checkpointVisible"]),
      resources: {
        ...numbers(p.resources, ["latencyMs", "inputTokens", "outputTokens", "totalTokens", "costUsd"]),
        budget: b ? { ...numbers(b, ["maxSearchCalls", "maxToolCalls", "maxBudgetedCalls", "maxQueryRepeats", "noProgressMs", "pollIntervalMs"]), triggered: choice(b.triggered, ERROR_CODES) } : null,
      },
      artifacts: {
        ...numbers(p.artifacts, ["count", "textCaptured"]), ...booleans(p.artifacts, ["versioned", "truncated"]),
        items: (p.artifacts?.items ?? []).map((a, i) => ({
          id: `artifact-${i + 1}`, size: metric(a.size), extension: EXTENSIONS.has(a.extension) ? a.extension : "other",
          ...booleans(a, ["readable", "textIncluded", "scoringEligible"]),
        })),
      },
    },
    resultLedger: {
      status: choice(result.status, STATUSES),
      facts: { ...numbers(result.facts, ["correct", "wrong", "missing"]), ...(Object.hasOwn(result.facts ?? {}, "score") ? { score: metric(result.facts.score) } : {}) },
      deliverables: {
        ...numbers(result.deliverables, ["required", "met", "completeness"]),
        checks: (result.deliverables?.checks ?? []).map((c, i) => ({ id: `check-${i + 1}`, ...booleans(c, ["critical", "met"]) })),
      },
      citations: numbers(result.citations, ["total", "open", "validity", "faithful", "keyClaimCoverage"]),
      researchCompletion: choice(result.researchCompletion, ["COMPLETE", "INCOMPLETE", "PARTIAL"]),
      risks: {
        ...numbers(result.risks, ["fabricatedFacts", "fabricatedCitations"]),
        conflictHandling: choice(result.risks?.conflictHandling, ["NOT_APPLICABLE", "PASS", "FAIL", "PARTIAL"]),
        forbiddenContentCount: result.risks?.forbiddenContent?.length ?? 0,
      },
      recovery: choice(result.recovery, ["NOT_TESTED", "PASS", "FAIL", "PARTIAL"]),
      uplift: choice(result.uplift, ["NOT_COMPARABLE", "NO_CLEAR", "POSITIVE", "NEGATIVE"]),
      reasonCount: result.reasons?.length ?? 0, reasonCodes: codes(result.reasons),
    },
    judge: r.judge ? {
      ok: flag(r.judge.ok), latencyMs: metric(r.judge.latencyMs),
      usage: numbers(r.judge.usage, ["inputTokens", "outputTokens", "totalTokens"]),
      verdict: verdict ? {
        status: choice(verdict.status, STATUSES),
        ...numbers(verdict, ["factualCorrectness", "deliverableCompleteness", "citationFaithfulness", "keyClaimCoverage", "fabricatedFacts", "fabricatedCitations"]),
        researchCompletion: choice(verdict.researchCompletion, ["COMPLETE", "INCOMPLETE", "PARTIAL"]),
        conflictHandling: choice(verdict.conflictHandling, ["NOT_APPLICABLE", "PASS", "FAIL", "PARTIAL"]),
      } : null,
    } : null,
  };
}

export function sanitizeRecords(records) {
  if (records.length !== 40) throw new Error("V12 release requires exactly 40 records");
  const clean = records.map(sanitizeRecord).sort((a, b) => a.condition.localeCompare(b.condition) || TASKS.indexOf(a.taskId) - TASKS.indexOf(b.taskId));
  const ids = new Set(clean.map((r) => `${r.condition}-${r.taskId}`));
  if (ids.size !== 40) throw new Error("Duplicate/missing V12 record");
  return clean;
}

export function publicLeaderboard(records, generatedAt) {
  const allConditions = aggregateRecords(records);
  return {
    schemaVersion: 1, suiteId: SUITE_ID, generatedAt: isoDate(generatedAt),
    rankingRule: "准入 → 编造 → LF PASS/PARTIAL → 引用忠实度 → SF PASS → 恢复 → 负增量 → 效率",
    baseline: allConditions.find((r) => r.condition === "C0"),
    leaderboard: rankSummaries(allConditions).map((r, i) => ({ rank: i + 1, ...r })), allConditions,
  };
}

export const PUBLIC_BOUNDARIES = [
  "仅发布 V12 最终选择的 40 条记录：C0 加 7 个插件，每个条件 5 个测评项；不包含全部历史失败批次。",
  "R1/R3 为短事实，R6/R7 为长报告，R10 由 R6 派生，不是第五次独立模型执行；缺失资源值保留 null，不改成零。",
  "移除题面、gold、回答正文、工具参数及返回正文、异常消息、Judge 理由、证据摘录、文件内容与路径、完整 URL 和查询词。",
  "来源及产物仅保留匿名编号和数值/布尔元数据；原始 run ID 用不含内容信息的来源指纹代替。",
  "错误、超时、重试、Fallback、人工介入计数为原评测器文本规则命中次数，不等同于独立故障或真人操作次数。",
  "Token 和耗时沿用原始账本及既有汇总口径，不代表包含全部已丢弃尝试和 Judge 的供应商账单总量。",
  "本发布是既有数据的脱敏导出；未重跑评测、未调用模型、未修改分数或排名。",
];
