import { emptyProcessLedger, extractUrls, uniqueDomains } from "./lib.mjs";

const SEARCH_RE = /search|query|检索|搜索/i;
const FETCH_RE = /fetch|crawl|reader|browser|open_url|抓取|网页/i;
const ANALYSIS_RE = /analy|research|reason|compute|python|分析|研究|计算/i;
const WRITE_RE = /write|report|artifact|draft|save|报告|草稿|产物/i;
const ERROR_RE = /error|failed|failure|exception|错误|失败/i;
const TIMEOUT_RE = /timeout|timed out|超时/i;
const RETRY_RE = /retry|重试/i;
const FALLBACK_RE = /fallback|degrad|降级|备用/i;
const MANUAL_RE = /approval|required confirmation|human gate|人工|审批|确认后继续/i;
const MANAGEMENT_RE = /^(?:list_agents|todo_write|subagent|interrupt_agent|send_message|send_input|wait_agent|wait_threads?|agent_status)$/i;
const FILE_RE = /^(?:read|write|edit|apply_patch|glob|ls|list_files?|mkdir|save|artifact_write)$/i;
const COMPUTE_RE = /(?:^|[_-])(?:bash|shell|exec|command|python|node|compute|calculator)(?:$|[_-])/i;

export function foldHistory(events, options = {}) {
  const ledger = emptyProcessLedger(options.environment ?? {});
  const toolSummary = countToolCalls(events);
  const allText = [];
  const evidenceExcerpts = [];
  const tokenValuesBySession = new Map();

  for (const raw of events ?? []) {
    const event = raw?.event ?? raw;
    const type = String(event?.type ?? event?.name ?? "").toLowerCase();
    const text = eventText(event);
    if (text) allText.push(text);

    if ((type.includes("tool") || type.includes("result")) && text && extractUrls(text).length) {
      evidenceExcerpts.push(text.slice(0, 1200));
    }
    if (ERROR_RE.test(type) || ERROR_RE.test(text)) {
      ledger.anomalies.errors += 1;
      pushUnique(ledger.anomalies.messages, compact(text || type));
    }
    if (TIMEOUT_RE.test(type) || TIMEOUT_RE.test(text)) ledger.anomalies.timeouts += 1;
    if (RETRY_RE.test(text)) ledger.anomalies.retries += 1;
    if (FALLBACK_RE.test(text)) ledger.anomalies.fallbacks += 1;
    if (MANUAL_RE.test(text)) ledger.anomalies.manualInterventions += 1;
    const sessionKey = raw?.sessionId ?? "__root__";
    if (!tokenValuesBySession.has(sessionKey)) tokenValuesBySession.set(sessionKey, { input: [], output: [], total: [] });
    collectTokens(event, tokenValuesBySession.get(sessionKey));
  }

  const answer = String(options.answer ?? "");
  const eventTextJoined = allText.join("\n");
  if (answer) allText.push(answer);
  const joined = allText.join("\n");
  ledger.research.planVisible = /(^|\n)\s*(研究)?计划|步骤\s*[：:]|plan\b/i.test(joined);
  ledger.research.subquestionsVisible = /子问题|分问题|研究问题\s*[一二三四五0-9]|sub-?question/i.test(joined);
  ledger.research.completedSteps = countCompletedSteps(joined);

  const retrievedUrls = extractUrls(eventTextJoined);
  const answerUrls = extractUrls(answer);
  const urls = [...new Set([...retrievedUrls, ...answerUrls])];
  ledger.sources.totalUrls = urls.length;
  ledger.sources.uniqueDomains = uniqueDomains(urls).length;
  ledger.sources.retrievedUrls = retrievedUrls;
  ledger.sources.answerUrls = answerUrls;
  ledger.sources.urls = urls.map((url) => ({ url, open: null, status: null }));

  const artifacts = extractArtifacts(joined);
  ledger.artifacts.count = artifacts.length;
  ledger.artifacts.paths = artifacts;
  ledger.artifacts.versioned = /version|版本|v\d+(?:\.\d+)+/i.test(joined);

  const tokenUsage = aggregateSessionTokens(tokenValuesBySession);
  ledger.resources.inputTokens = tokenUsage.input;
  ledger.resources.outputTokens = tokenUsage.output;
  ledger.resources.totalTokens = tokenUsage.total;
  if (Number.isFinite(options.startedAt) && Number.isFinite(options.endedAt)) {
    ledger.resources.latencyMs = Math.max(0, options.endedAt - options.startedAt);
  }

  if (options.recovery) ledger.recovery = { ...ledger.recovery, ...options.recovery };
  ledger.tools = { ...ledger.tools, ...toolSummary };
  ledger.evidenceExcerpts = [...new Set(evidenceExcerpts)].slice(0, 20);
  return ledger;
}

export function countToolCalls(events) {
  const counts = {
    totalCalls: 0,
    budgetedCalls: 0,
    searchCalls: 0,
    fetchCalls: 0,
    analysisCalls: 0,
    writeCalls: 0,
    managementCalls: 0,
    fileCalls: 0,
    names: {},
    queryStats: { total: 0, unique: 0, duplicate: 0, maxRepeat: 0 },
  };
  const queryCounts = new Map();
  for (const raw of events ?? []) {
    const event = raw?.event ?? raw;
    const type = String(event?.type ?? event?.name ?? "").toLowerCase();
    const toolName = findToolName(event);
    if (!toolName || !isToolCall(event, type)) continue;
    counts.totalCalls += 1;
    counts.names[toolName] = (counts.names[toolName] ?? 0) + 1;
    const category = toolCategory(toolName);
    if (category === "search") {
      counts.searchCalls += 1;
      for (const query of extractSearchQueries(event)) {
        queryCounts.set(query, (queryCounts.get(query) ?? 0) + 1);
      }
    } else if (category === "management") {
      counts.managementCalls += 1;
    } else if (category === "file") {
      counts.fileCalls += 1;
      if (WRITE_RE.test(toolName)) counts.writeCalls += 1;
    } else {
      counts.budgetedCalls += 1;
      if (category === "fetch") counts.fetchCalls += 1;
      if (category === "analysis") counts.analysisCalls += 1;
    }
  }
  const repetitions = [...queryCounts.values()];
  counts.queryStats = {
    total: repetitions.reduce((sum, value) => sum + value, 0),
    unique: queryCounts.size,
    duplicate: repetitions.reduce((sum, value) => sum + Math.max(0, value - 1), 0),
    maxRepeat: repetitions.length ? Math.max(...repetitions) : 0,
  };
  return counts;
}

export function detectInfrastructureFailure(events) {
  for (const raw of events ?? []) {
    const event = raw?.event ?? raw;
    const text = eventText(event);
    const match = text.match(/DeepSeek API (?:request|stream)[^\n]{0,300}?failed\s+(TRANSPORT|TIMEOUT|SERVER|RATE_LIMIT|EMPTY_RESPONSE)/iu);
    if (match) return `MODEL_PROVIDER_${match[1].toUpperCase()}: DeepSeek API ${match[1].toLowerCase()} failure`;
    if (/Insufficient Balance\s+QUOTA/iu.test(text)) {
      return "MODEL_PROVIDER_QUOTA: DeepSeek account balance is insufficient";
    }
    if (/WEB_PROVIDER_ERROR/iu.test(text) && /unprocessable response body|terminated|web search failed/iu.test(text)) {
      return "MODEL_PROVIDER_WEB: DeepSeek web provider failure";
    }
  }
  return null;
}

function toolCategory(toolName) {
  if (SEARCH_RE.test(toolName)) return "search";
  if (MANAGEMENT_RE.test(toolName)) return "management";
  if (FILE_RE.test(toolName)) return "file";
  if (FETCH_RE.test(toolName)) return "fetch";
  if (ANALYSIS_RE.test(toolName) || COMPUTE_RE.test(toolName)) return "analysis";
  return "other";
}

function extractSearchQueries(event) {
  const input = event?.data?.arguments ?? event?.data?.input ?? event?.arguments ?? event?.input;
  const output = [];
  collectQueryValues(input, output, new Set(), 0, true);
  return [...new Set(output.map(normalizeQuery).filter(Boolean))];
}

function collectQueryValues(value, output, seen, depth, direct = false) {
  if (depth > 6 || value == null) return;
  if (typeof value === "string") {
    if (direct) output.push(value);
    return;
  }
  if (typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectQueryValues(item, output, seen, depth + 1, direct);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const isQuery = /^(?:q|query|queries|searchQuery|search_query|searchTerm|search_term)$/i.test(key);
    collectQueryValues(item, output, seen, depth + 1, isQuery);
  }
}

function normalizeQuery(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function applyUrlChecks(processLedger, checks = []) {
  const byUrl = new Map(checks.map((item) => [item.url, item]));
  const urls = processLedger.sources.urls.map((item) => {
    const checked = byUrl.get(item.url);
    return checked ? { ...item, ...checked } : item;
  });
  return {
    ...processLedger,
    sources: {
      ...processLedger.sources,
      urls,
      checkedUrls: checks.length,
      openUrls: checks.filter((item) => item.open).length,
      answerCheckedUrls: processLedger.sources.answerUrls.filter((url) => byUrl.has(url)).length,
      answerOpenUrls: processLedger.sources.answerUrls.filter((url) => byUrl.get(url)?.open).length,
    },
  };
}

function eventText(value) {
  const strings = [];
  collectStrings(value, strings, new Set(), 0);
  return strings.join("\n").slice(0, 20_000);
}

function collectStrings(value, output, seen, depth) {
  if (depth > 7 || output.length > 200 || value == null) return;
  if (typeof value === "string") {
    if (value.trim()) output.push(value);
    return;
  }
  if (typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output, seen, depth + 1);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (/api.?key|authorization|credential|secret|token$/i.test(key)) continue;
    collectStrings(item, output, seen, depth + 1);
  }
}

function findToolName(event) {
  return String(
    event?.data?.toolName ??
      event?.data?.name ??
      event?.toolName ??
      event?.tool?.name ??
      event?.name ??
      "",
  ).trim();
}

function isToolCall(event, type) {
  if (/tool.*(?:call|start|request)|(?:call|start).*tool/i.test(type)) return true;
  if (event?.data?.arguments != null || event?.data?.input != null) return true;
  return false;
}

function collectTokens(value, output, seen = new Set(), depth = 0) {
  if (depth > 8 || value == null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, item] of Object.entries(value)) {
    if (Number.isFinite(item)) {
      if (/^(input|prompt)(?:_?tokens?)?$/i.test(key)) output.input.push(item);
      if (/^(output|completion)(?:_?tokens?)?$/i.test(key)) output.output.push(item);
      if (/^total(?:_?tokens?)?$/i.test(key)) output.total.push(item);
    } else if (item && typeof item === "object") {
      collectTokens(item, output, seen, depth + 1);
    }
  }
}

function countCompletedSteps(text) {
  const matches = text.match(/(?:^|\n)\s*(?:[-*]|\d+[.)、])\s*(?:完成|已完成|结论|结果)/giu);
  return matches?.length ?? 0;
}

function extractArtifacts(text) {
  const paths = text.match(/(?:[A-Za-z]:\\|\/)[^\s<>"']+\.(?:md|json|csv|xlsx|pdf|html|png|svg)/giu) ?? [];
  return [...new Set(paths.map((value) => value.replace(/[),.;，。]+$/u, "")))];
}

function compact(text) {
  return String(text).replace(/\s+/g, " ").trim().slice(0, 300);
}

function pushUnique(list, value) {
  if (value && !list.includes(value) && list.length < 20) list.push(value);
}

function maxOrNull(values) {
  return values.length ? Math.max(...values) : null;
}

function aggregateSessionTokens(valuesBySession) {
  const sessions = [...valuesBySession.values()].map((values) => {
    const input = maxOrNull(values.input);
    const output = maxOrNull(values.output);
    return { input, output, total: reconcileTokenTotal(maxOrNull(values.total), input, output) };
  });
  const sum = (field) => {
    const values = sessions.map((session) => session[field]).filter(Number.isFinite);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  return { input: sum("input"), output: sum("output"), total: sum("total") };
}

function sumNullable(left, right) {
  return Number.isFinite(left) || Number.isFinite(right) ? (left ?? 0) + (right ?? 0) : null;
}

export function reconcileTokenTotal(observedTotal, inputTokens, outputTokens) {
  const componentTotal = sumNullable(inputTokens, outputTokens);
  const candidates = [observedTotal, componentTotal].filter((value) => Number.isFinite(value) && value >= 0);
  return candidates.length ? Math.max(...candidates) : null;
}
