import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
export const EVAL_ROOT = join(MODULE_DIR, "..");

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readJsonl(path) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`JSONL 第 ${index + 1} 行无效: ${safeError(error)}`);
      }
    });
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function fileSha256(path) {
  return sha256(readFileSync(path));
}

export function extractUrls(value) {
  const matches = String(value ?? "").match(/https?:\/\/[^\s<>{}\[\]"'`]+/giu) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[)\]}>）,.;:!?，。；：！？】》」』]+$/u, "")))];
}

export function uniqueDomains(urls) {
  const domains = [];
  for (const value of urls ?? []) {
    try {
      const host = new URL(value).hostname.toLowerCase().replace(/^www\./u, "");
      if (host && !domains.includes(host)) domains.push(host);
    } catch {
      // Invalid values stay visible in the URL ledger.
    }
  }
  return domains;
}

export function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

export function mean(values) {
  const numbers = values.filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
}

export function safeError(error) {
  return redactSecrets(error instanceof Error ? error.message : error ?? "unknown error").slice(0, 2000);
}

export function redactSecrets(value) {
  return String(value)
    .replace(/\bBearer\s+\S+/giu, "Bearer [REDACTED]")
    .replace(/((?:api[_-]?key|authorization|credential|secret|access[_-]?token|bearer)\s*[:=]\s*)\S+/giu, "$1[REDACTED]")
    .replace(/([?&](?:api[_-]?key|key|token|secret|tavilyApiKey|braveApiKey|pplx_api_key)=)[^&\s]+/giu, "$1[REDACTED]")
    .replace(/(?:sk|tvly|xai|brv|exa|as_sk)[-_A-Za-z0-9]{10,}/giu, "[REDACTED]");
}

export function isoNow() {
  return new Date().toISOString();
}

export function createRunId(condition, batchId) {
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  return `${batchId}-${condition}-${timestamp}`.replace(/[^A-Za-z0-9._-]+/gu, "-");
}

export function stableHash(value) {
  return sha256(JSON.stringify(sortKeys(value)));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
}
