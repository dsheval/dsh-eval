import { safeError } from "./lib.mjs";

export function buildJudgePrompt(task, answer, processLedger) {
  return [
    "你是搜索插件证据质量盲评 Judge。不得猜测插件名称，也不得因为回答更长、文风更好或工具调用更多而加分。",
    "只能依据题目、最终回答、已捕获的搜索/抓取证据和 URL 检查结果判断；不得自行联网或补充外部知识。证据不足必须保守评分。",
    "逐项检查回答中的关键可验证主张是否被紧邻引用或可明确映射的来源支持，并判断来源是否为原始/权威来源。",
    "严格输出一个 JSON 对象，不要 Markdown。",
    "字段：status(PASS|PARTIAL|FAIL), sourceQuality(0-4), citationCorrectness(0-4或null), citationCompleteness(0-4), claimSupport(0-1), primarySourceRatio(0-1或null), keyClaims(整数), supportedKeyClaims(整数), unsupportedClaims(整数), fabricatedCitations(整数), reasons(字符串数组)。",
    "fabricatedCitations 只统计明显捏造、打不开且未在检索证据出现、或来源内容与所引主张无关的引用；不能仅因 URL 未被工具日志捕获就判定捏造。",
    `任务（上游原题）：${task.prompt}`,
    `最终回答：${String(answer).slice(0, 60000)}`,
    `检索过程摘要：${JSON.stringify({ tools: processLedger.tools, queries: processLedger.queries, providers: processLedger.providers, sources: processLedger.sources, results: processLedger.results, resilience: processLedger.resilience })}`,
    `捕获证据：${JSON.stringify((processLedger.evidenceExcerpts ?? []).slice(0, 20))}`,
  ].join("\n\n");
}

export async function runJudge(input, options = {}) {
  const config = input.config;
  const apiKey = options.apiKey ?? process.env[config.apiKeyEnv];
  if (!apiKey) return failure("MISSING_KEY", `缺少 Judge Key ${config.apiKeyEnv}`);
  const model = options.model ?? process.env[config.modelEnv] ?? config.defaultModel;
  const started = Date.now();
  try {
    const response = await (options.fetch ?? fetch)(config.baseUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: config.temperature ?? 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return strict JSON only." },
          { role: "user", content: buildJudgePrompt(input.task, input.answer, input.processLedger) },
        ],
      }),
      signal: AbortSignal.timeout(config.timeoutMs ?? 180000),
    });
    const text = await response.text();
    if (!response.ok) return failure(`HTTP_${response.status}`, `Judge HTTP ${response.status}`, { model, latencyMs: Date.now() - started });
    const payload = JSON.parse(text);
    const content = payload?.choices?.[0]?.message?.content;
    return {
      ok: true,
      provider: config.provider,
      model,
      latencyMs: Date.now() - started,
      usage: sanitizeUsage(payload?.usage),
      verdict: validateVerdict(parseObject(content)),
    };
  } catch (error) {
    return failure("REQUEST_ERROR", safeError(error), { model, latencyMs: Date.now() - started });
  }
}

function parseObject(value) {
  return JSON.parse(String(value ?? "").trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, ""));
}

export function validateVerdict(value) {
  if (!value || !["PASS", "PARTIAL", "FAIL"].includes(value.status)) throw new Error("Judge status 非法");
  for (const key of ["sourceQuality", "citationCorrectness", "citationCompleteness"]) {
    if (value[key] != null && (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 4)) throw new Error(`Judge ${key} 非法`);
  }
  for (const key of ["claimSupport", "primarySourceRatio"]) {
    if (value[key] != null && (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1)) throw new Error(`Judge ${key} 非法`);
  }
  for (const key of ["keyClaims", "supportedKeyClaims", "unsupportedClaims", "fabricatedCitations"]) {
    if (!Number.isInteger(value[key]) || value[key] < 0) throw new Error(`Judge ${key} 非法`);
  }
  return { ...value, reasons: Array.isArray(value.reasons) ? value.reasons.map(String).slice(0, 20) : [] };
}

function sanitizeUsage(usage) {
  if (!usage) return null;
  return { inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? null, outputTokens: usage.completion_tokens ?? usage.output_tokens ?? null, totalTokens: usage.total_tokens ?? null };
}

function failure(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}
