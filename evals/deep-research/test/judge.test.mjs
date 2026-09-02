import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyProcessLedger } from "../src/lib.mjs";
import { buildJudgePrompt, runJudge } from "../src/judge.mjs";

const config = {
  provider: "openai-compatible",
  baseUrl: "https://judge.example/v1/chat/completions",
  apiKeyEnv: "TEST_JUDGE_KEY",
  defaultModel: "judge-test",
  timeoutMs: 1000,
};

test("Judge prompt 不包含插件身份字段", () => {
  const prompt = buildJudgePrompt({ prompt: "题目", deliverables: [] }, "回答", emptyProcessLedger());
  assert.doesNotMatch(prompt, /P7|dsh-ai4scholar|literaf/i);
  assert.match(prompt, /盲评/);
});

test("缺 Judge Key 返回结构化错误", async () => {
  const result = await runJudge({ config, task: { prompt: "题" }, answer: "答", processLedger: emptyProcessLedger() }, { apiKey: null });
  assert.equal(result.ok, false);
  assert.equal(result.code, "MISSING_KEY");
});

test("Judge 只保留结构化 verdict 和 token", async () => {
  const fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ status: "PASS", factualCorrectness: 4, deliverableCompleteness: 4, citationFaithfulness: 3, keyClaimCoverage: 0.75, researchCompletion: "COMPLETE", fabricatedFacts: 0, fabricatedCitations: 0, conflictHandling: "PASS", reasons: ["ok"] }) } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  const result = await runJudge(
    { config, task: { prompt: "题", deliverables: [] }, answer: "答", processLedger: emptyProcessLedger() },
    { apiKey: "secret-not-logged", fetch },
  );
  assert.equal(result.ok, true);
  assert.equal(result.verdict.status, "PASS");
  assert.equal(result.usage.totalTokens, 15);
  assert.equal("apiKey" in result, false);
});
