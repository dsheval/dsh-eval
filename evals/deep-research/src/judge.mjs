import { safeError } from "./lib.mjs";

export function buildJudgePrompt(task, answer, processLedger) {
  const evidence = (processLedger.evidenceExcerpts ?? []).slice(0, 12);
  return [
    "你是 Deep Research 盲评 Judge。你不知道被测插件名称，也不得根据文风猜测插件。",
    "只根据题目、回答、确定性检查和已捕获证据评分。没有证据支持的事实标 unknown，不得自行补充外部知识。",
    "严格输出一个 JSON 对象，不要 Markdown。",
    "状态只能是 PASS、PARTIAL、FAIL。",
    "JSON 字段：status, factualCorrectness(0-4), deliverableCompleteness(0-4), citationFaithfulness(0-4或null), keyClaimCoverage(0-1或null), researchCompletion(COMPLETE|SEARCH_ONLY|INCOMPLETE), fabricatedFacts(整数或null), fabricatedCitations(整数或null), conflictHandling(PASS|FAIL|NOT_APPLICABLE), reasons(字符串数组)。",
    `题目：${task.prompt}`,
    `强制交付物：${JSON.stringify(task.deliverables ?? [])}`,
    `最少可打开 URL：${task.minOpenUrls ?? 0}`,
    `回答：${String(answer).slice(0, 60_000)}`,
    `URL 检查：${JSON.stringify(processLedger.sources ?? {})}`,
    `捕获证据摘录：${JSON.stringify(evidence)}`,
  ].join("\n\n");
}

export async function runJudge(input, options = {}) {
  const config = input.config;
  const apiKey = options.apiKey ?? process.env[config.apiKeyEnv];
  if (!apiKey) {
    return judgeError("MISSING_KEY", `缺少 Judge Key 引用 ${config.apiKeyEnv}`);
  }
  const model = options.model ?? process.env[config.modelEnv] ?? config.defaultModel;
  if (!model) return judgeError("MISSING_MODEL", "缺少 Judge 模型");
  const fetchImpl = options.fetch ?? fetch;
  const started = Date.now();
  try {
    const response = await fetchImpl(config.baseUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return strict JSON only." },
          { role: "user", content: buildJudgePrompt(input.task, input.answer, input.processLedger) },
        ],
      }),
      signal: AbortSignal.timeout(config.timeoutMs ?? 180_000),
    });
    const body = await response.text();
    if (!response.ok) return judgeError(`HTTP_${response.status}`, `Judge HTTP ${response.status}`, { model, latencyMs: Date.now() - started });
    const payload = JSON.parse(body);
    const content = payload?.choices?.[0]?.message?.content;
    const verdict = validateVerdict(parseJsonObject(content));
    return {
      ok: true,
      provider: config.provider,
      model,
      latencyMs: Date.now() - started,
      usage: sanitizeUsage(payload?.usage),
      verdict,
    };
  } catch (error) {
    return judgeError("REQUEST_ERROR", safeError(error), { model, latencyMs: Date.now() - started });
  }
}

function parseJsonObject(value) {
  const text = String(value ?? "").trim();
  const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(unfenced);
}

function validateVerdict(value) {
  if (!value || !["PASS", "PARTIAL", "FAIL"].includes(value.status)) throw new Error("Judge status 非法");
  for (const key of ["factualCorrectness", "deliverableCompleteness", "citationFaithfulness"]) {
    if (value[key] != null && (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 4)) {
      throw new Error(`Judge ${key} 非法`);
    }
  }
  if (value.keyClaimCoverage != null && (!Number.isFinite(value.keyClaimCoverage) || value.keyClaimCoverage < 0 || value.keyClaimCoverage > 1)) {
    throw new Error("Judge keyClaimCoverage 非法");
  }
  if (!["COMPLETE", "SEARCH_ONLY", "INCOMPLETE"].includes(value.researchCompletion)) {
    throw new Error("Judge researchCompletion 非法");
  }
  return {
    ...value,
    reasons: Array.isArray(value.reasons) ? value.reasons.map(String).slice(0, 20) : [],
  };
}

function sanitizeUsage(usage) {
  if (!usage) return null;
  return {
    inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? null,
    outputTokens: usage.completion_tokens ?? usage.output_tokens ?? null,
    totalTokens: usage.total_tokens ?? null,
  };
}

function judgeError(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}
