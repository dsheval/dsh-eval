import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
export const EVAL_ROOT = join(MODULE_DIR, "..");

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

export function extractUrls(value) {
  const text = String(value ?? "");
  const matches = text.match(/https?:\/\/[^\s<>{}\[\]"'`]+/giu) ?? [];
  const cleaned = matches.map((url) => url.replace(/[),.;:!?，。；：！？]+$/u, ""));
  return [...new Set(cleaned)];
}

export function uniqueDomains(urls) {
  const domains = [];
  for (const value of urls ?? []) {
    try {
      const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
      if (host && !domains.includes(host)) domains.push(host);
    } catch {
      // Invalid URLs remain visible in the URL ledger but have no domain.
    }
  }
  return domains;
}

export function mean(values) {
  const rows = values.filter((value) => Number.isFinite(value));
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
}

export function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

export function safeError(error) {
  const text = error instanceof Error ? error.message : String(error ?? "unknown error");
  return text
    .replace(/(?:sk|tvly|xai|brv|exa|Bearer)[-_A-Za-z0-9]{12,}/gi, "[REDACTED]")
    .slice(0, 2000);
}

export function isoNow() {
  return new Date().toISOString();
}

export function createRunId(prefix = "research-eval") {
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${prefix}`;
}

export function emptyProcessLedger(environment = {}) {
  return {
    environment,
    research: {
      planVisible: false,
      subquestionsVisible: false,
      completedSteps: 0,
    },
    tools: {
      totalCalls: 0,
      searchCalls: 0,
      fetchCalls: 0,
      analysisCalls: 0,
      writeCalls: 0,
      names: {},
    },
    sources: {
      totalUrls: 0,
      checkedUrls: 0,
      openUrls: 0,
      retrievedUrls: [],
      answerUrls: [],
      answerCheckedUrls: 0,
      answerOpenUrls: 0,
      uniqueDomains: 0,
      firstPartyUrls: null,
      urls: [],
    },
    anomalies: {
      errors: 0,
      timeouts: 0,
      retries: 0,
      fallbacks: 0,
      manualInterventions: 0,
      messages: [],
    },
    recovery: {
      interrupted: false,
      resumed: false,
      restartedFromBeginning: null,
      checkpointVisible: false,
    },
    resources: {
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      costUsd: null,
    },
    artifacts: {
      count: 0,
      paths: [],
      versioned: false,
    },
  };
}

export function emptyResultLedger() {
  return {
    status: "NOT_SCORED",
    facts: { correct: null, wrong: null, missing: null },
    deliverables: { required: 0, met: 0, completeness: null, checks: [] },
    citations: {
      total: 0,
      open: 0,
      validity: null,
      faithful: null,
      keyClaimCoverage: null,
    },
    researchCompletion: "INCOMPLETE",
    risks: {
      fabricatedFacts: null,
      fabricatedCitations: null,
      conflictHandling: "NOT_APPLICABLE",
      forbiddenContent: [],
    },
    recovery: "NOT_TESTED",
    uplift: "NOT_COMPARABLE",
    reasons: [],
  };
}
