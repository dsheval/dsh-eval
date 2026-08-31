import { extractUrls, ratio, redactSecrets, uniqueDomains } from "./lib.mjs";

const SEARCH_RE = /(?:^|[_:.\-/])(search|query|find|lookup|检索|搜索)(?:$|[_:.\-/])/iu;
const FETCH_RE = /(?:^|[_:.\-/])(fetch|crawl|reader|browse|open|extract|read)(?:$|[_:.\-/])/iu;
const ERROR_RE = /error|failed|failure|exception|错误|失败|不可用/iu;
const TIMEOUT_RE = /timeout|timed out|超时/iu;
const FALLBACK_RE = /fallback|failover|degrad|using .+ instead|回退|降级|备用|改用/iu;
const URL_KEYS = new Set(["url", "link", "href", "source_url", "sourceUrl"]);
const TITLE_KEYS = new Set(["title", "name", "headline"]);
const SNIPPET_KEYS = new Set(["snippet", "description", "summary", "content", "text", "abstract"]);

export function foldHistory(events, options = {}) {
  const ledger = emptyLedger(options.environment ?? {});
  const evidence = [];
  const resultTextUrls = [];
  for (const raw of events ?? []) {
    const event = raw?.event ?? raw;
    const type = String(event?.type ?? event?.name ?? "").toLowerCase();
    const toolName = toolNameOf(event);
    const text = eventText(event);
    const call = toolName && isToolCall(event, type);
    const result = isToolResult(event, type);
    if (call) {
      ledger.tools.totalCalls += 1;
      ledger.tools.names[toolName] = (ledger.tools.names[toolName] ?? 0) + 1;
      if (isSearch(toolName)) ledger.tools.searchCalls += 1;
      if (isFetch(toolName)) ledger.tools.fetchCalls += 1;
      const query = queryOf(event);
      if (query && !ledger.queries.includes(query)) ledger.queries.push(query);
    }
    if (result) {
      ledger.tools.totalResults += 1;
      const failed = toolResultFailed(event, type, text);
      if (failed) ledger.tools.failedResults += 1;
      else ledger.tools.successfulResults += 1;
      const rows = structuredResults(event);
      resultTextUrls.push(...extractUrls(text).map(sanitizeUrl));
      ledger.results.total += rows.length;
      for (const row of rows) {
        ledger.results.withUrl += Number(Boolean(row.url));
        ledger.results.withTitle += Number(Boolean(row.title));
        ledger.results.withSnippet += Number(Boolean(row.snippet));
        if (row.url) ledger.results.urls.push(sanitizeUrl(row.url));
      }
      if (text && (rows.length || extractUrls(text).length)) evidence.push(redactSecrets(text).slice(0, 4000));
    }
    if (ERROR_RE.test(type) || result && toolResultFailed(event, type, text)) {
      ledger.resilience.errors += 1;
      pushUnique(ledger.resilience.messages, compact(text || type));
    }
    if (TIMEOUT_RE.test(type) || result && TIMEOUT_RE.test(text) && (toolResultFailed(event, type, text) || FALLBACK_RE.test(text))) ledger.resilience.timeouts += 1;
    if (result && FALLBACK_RE.test(text)) {
      ledger.resilience.fallbacks += 1;
      pushUnique(ledger.resilience.fallbackEvidence, compact(text));
    }
    if (call || result) for (const provider of providerNames(event, text)) pushUnique(ledger.providers, provider);
  }

  const answer = String(options.answer ?? "");
  // Only tool-result payloads count as retrieved evidence. URLs emitted solely by the
  // final answer remain unobserved and can never validate themselves.
  const retrievedUrls = [...new Set([...ledger.results.urls, ...resultTextUrls])];
  const answerUrls = extractUrls(answer).map(sanitizeUrl);
  ledger.sources.retrievedUrls = retrievedUrls;
  ledger.sources.answerUrls = answerUrls;
  ledger.sources.unobservedAnswerUrls = answerUrls.filter((url) => !retrievedUrls.includes(url));
  ledger.sources.urls = [...new Set([...retrievedUrls, ...answerUrls])].map((url) => ({ url, open: null, status: null }));
  ledger.sources.uniqueDomains = uniqueDomains(retrievedUrls).length;
  ledger.tools.successRate = ratio(ledger.tools.successfulResults, ledger.tools.totalResults);
  const structuredDenominator = ledger.results.total * 3;
  ledger.results.structuredCompleteness = ratio(ledger.results.withUrl + ledger.results.withTitle + ledger.results.withSnippet, structuredDenominator);
  ledger.evidenceExcerpts = [...new Set(evidence)].slice(0, 24);
  if (Number.isFinite(options.startedAt) && Number.isFinite(options.endedAt)) ledger.resources.latencyMs = Math.max(0, options.endedAt - options.startedAt);
  return ledger;
}

export function applyUrlChecks(ledger, checks) {
  const byUrl = new Map(checks.map((row) => [row.url, row]));
  const urls = ledger.sources.urls.map((row) => ({ ...row, ...(byUrl.get(row.url) ?? {}) }));
  const retrievedChecks = ledger.sources.retrievedUrls.map((url) => byUrl.get(url)).filter(Boolean);
  const answerChecks = ledger.sources.answerUrls.map((url) => byUrl.get(url)).filter(Boolean);
  return {
    ...ledger,
    sources: {
      ...ledger.sources,
      urls,
      checkedUrls: checks.length,
      openUrls: checks.filter((row) => row.open).length,
      retrievedCheckedUrls: retrievedChecks.length,
      retrievedOpenUrls: retrievedChecks.filter((row) => row.open).length,
      answerCheckedUrls: answerChecks.length,
      answerOpenUrls: answerChecks.filter((row) => row.open).length,
      urlValidity: ratio(retrievedChecks.filter((row) => row.open).length, retrievedChecks.length),
      suspiciousAnswerUrls: ledger.sources.unobservedAnswerUrls.filter((url) => byUrl.get(url)?.open === false),
    },
  };
}

export function emptyLedger(environment = {}) {
  return {
    environment,
    tools: { totalCalls: 0, searchCalls: 0, fetchCalls: 0, totalResults: 0, successfulResults: 0, failedResults: 0, successRate: null, names: {} },
    queries: [],
    providers: [],
    results: { total: 0, withUrl: 0, withTitle: 0, withSnippet: 0, structuredCompleteness: null, urls: [] },
    sources: { retrievedUrls: [], answerUrls: [], unobservedAnswerUrls: [], suspiciousAnswerUrls: [], urls: [], uniqueDomains: 0, checkedUrls: 0, openUrls: 0, retrievedCheckedUrls: 0, retrievedOpenUrls: 0, answerCheckedUrls: 0, answerOpenUrls: 0, urlValidity: null },
    resilience: { errors: 0, timeouts: 0, fallbacks: 0, fallbackEvidence: [], messages: [] },
    resources: { latencyMs: null, inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null },
    evidenceExcerpts: [],
  };
}

function toolNameOf(event) {
  return String(event?.data?.toolName ?? event?.data?.name ?? event?.toolName ?? event?.tool?.name ?? event?.name ?? "").trim();
}

function isToolCall(event, type) {
  return /tool.*(?:call|start|request)|(?:call|start).*tool/iu.test(type) || event?.data?.arguments != null || event?.data?.input != null;
}

function isToolResult(event, type) {
  return /tool.*(?:result|end|response)|(?:result|end|response).*tool/iu.test(type) || event?.data?.result != null || event?.result != null;
}

function toolResultFailed(event, type, text) {
  const flags = [];
  visit(event, (object) => {
    if (typeof object.isError === "boolean") flags.push(object.isError);
    if (typeof object.ok === "boolean") flags.push(!object.ok);
  });
  if (flags.includes(true)) return true;
  if (flags.includes(false)) return false;
  return ERROR_RE.test(type) || ERROR_RE.test(text);
}

function isSearch(name) {
  return SEARCH_RE.test(`/${name}/`) || /search/iu.test(name);
}

function isFetch(name) {
  return FETCH_RE.test(`/${name}/`) || /fetch|reader|crawl|extract/iu.test(name);
}

function queryOf(event) {
  const value = event?.data?.arguments ?? event?.data?.input ?? event?.arguments ?? event?.input;
  const candidates = [value?.query, value?.q, value?.search_query, value?.keyword, value?.keywords];
  const hit = candidates.find((row) => typeof row === "string" && row.trim());
  return hit ? hit.trim().slice(0, 1000) : null;
}

function structuredResults(event) {
  const root = event?.data?.result ?? event?.result ?? event?.data?.output ?? event?.output ?? event;
  const rows = [];
  visit(root, (object) => {
    const url = firstValue(object, URL_KEYS, (value) => /^https?:\/\//iu.test(value));
    if (!url) return;
    rows.push({
      url,
      title: firstValue(object, TITLE_KEYS),
      snippet: firstValue(object, SNIPPET_KEYS),
    });
  });
  return dedupe(rows, (row) => row.url);
}

function firstValue(object, keys, predicate = () => true) {
  for (const [key, value] of Object.entries(object)) {
    if (keys.has(key) && typeof value === "string" && value.trim() && predicate(value.trim())) return value.trim();
  }
  return null;
}

function visit(value, callback, seen = new Set(), depth = 0) {
  if (!value || typeof value !== "object" || seen.has(value) || depth > 9) return;
  seen.add(value);
  if (!Array.isArray(value)) callback(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child, callback, seen, depth + 1);
}

function eventText(value) {
  const strings = [];
  collectStrings(value, strings, new Set(), 0);
  return strings.join("\n").slice(0, 30_000);
}

function collectStrings(value, output, seen, depth) {
  if (value == null || depth > 8 || output.length > 300) return;
  if (typeof value === "string") {
    if (value.trim()) output.push(value);
    return;
  }
  if (typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (/api.?key|authorization|credential|secret|token$/iu.test(key)) continue;
    collectStrings(child, output, seen, depth + 1);
  }
}

function providerNames(event, text) {
  const names = [];
  const explicit = [event?.data?.provider, event?.provider, event?.data?.engine, event?.engine];
  for (const value of explicit) if (typeof value === "string" && value.trim()) names.push(value.trim().slice(0, 80));
  const matches = text.match(/(?:provider|engine|source)[\s:=：-]+([A-Za-z][A-Za-z0-9_.-]{1,30})/giu) ?? [];
  for (const match of matches) names.push(match.split(/[\s:=：-]+/u).at(-1));
  return names;
}

function compact(value) {
  return redactSecrets(value).replace(/\s+/gu, " ").trim().slice(0, 400);
}

function pushUnique(list, value) {
  if (value && !list.includes(value) && list.length < 30) list.push(value);
}

function dedupe(rows, key) {
  const seen = new Set();
  return rows.filter((row) => {
    const value = key(row);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function sanitizeUrl(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/api.?key|token|secret|credential|authorization/iu.test(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return url.href;
  } catch {
    return value;
  }
}
