import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evalRoot } from "./lib.mjs";

const CONTEXT_ONLY = [
  "dsh-context",
  "dsh-context-doctor",
  "billion-context-dsh",
  "context-vista",
  "dsh-compaction-instant",
  "dsh-agent-compact",
  "dsh-mcp-lens",
  "dsh-plugin-bridge",
];

const MEMORY_NAME_RE =
  /mem(?:ory|9|ento|oria)?|mnemon|noema|hermes-memory|memory-vault|memory-gate|memory-evolve|causal-memory/i;
const MEMORY_TEXT_RE = /记忆|长期记忆|跨会话|remember|recall|mnemon|memory\b/i;

export function defaultCatalogPath() {
  return join(evalRoot(), "fixtures", "catalog.json");
}

export function loadCatalog(path = defaultCatalogPath()) {
  const catalog = JSON.parse(readFileSync(path, "utf8"));
  if (!catalog?.baseline || !Array.isArray(catalog.plugins)) {
    throw new Error(`名录缺少 baseline/plugins: ${path}`);
  }
  return catalog;
}

export function catalogTargets(catalog) {
  return [catalog.baseline, ...catalog.plugins];
}

export function findTarget(catalog, key) {
  const needle = String(key).trim().toLowerCase();
  return catalogTargets(catalog).find(
    (item) =>
      item.id.toLowerCase() === needle ||
      item.plugin.toLowerCase() === needle ||
      (item.fullName && item.fullName.toLowerCase() === needle),
  );
}

export function isContextOnly(entry) {
  const hay = `${entry.name ?? ""} ${entry.fullName ?? ""}`.toLowerCase();
  return CONTEXT_ONLY.some((name) => hay.includes(name));
}

export function isMemoryPlugin(entry) {
  if (!entry) return false;
  if (String(entry.type ?? "").toLowerCase() === "skill") return false;
  if (isContextOnly(entry)) return false;
  const name = `${entry.name ?? ""} ${entry.fullName ?? ""}`;
  if (MEMORY_NAME_RE.test(name)) return true;
  const hay = [
    entry.description,
    entry.descriptionZh,
    ...(entry.tags ?? []),
    ...(entry.topics ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  return MEMORY_TEXT_RE.test(hay);
}

export function targetFromRanking(entry, catalog) {
  const known = catalog.plugins.find(
    (item) =>
      item.fullName === entry.fullName ||
      item.plugin.toLowerCase() === String(entry.name ?? "").toLowerCase(),
  );
  // Rankings are discovery/ordering data, never an executable install manifest.
  // Unknown entries must be reviewed and pinned in the local catalog first.
  if (!known) return null;
  return {
    ...known,
    stars: entry.stars ?? known.stars,
  };
}

export function resolveTargets(catalog, options = {}) {
  const keys = (options.plugins ?? [])
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const selected = [];
  if (!options.noBaseline) selected.push(catalog.baseline);

  if (options.allMemory && options.rankings) {
    const ranked = (options.rankings.rankings?.total ?? [])
      .filter(isMemoryPlugin)
      .map((entry) => targetFromRanking(entry, catalog))
      .filter(Boolean);
    for (const item of ranked) pushUnique(selected, item);
  } else if (keys.length === 0) {
    for (const item of catalog.plugins) pushUnique(selected, item);
  } else {
    for (const key of keys) {
      if (key.toLowerCase() === "c0" || key.toLowerCase() === "none") continue;
      const found = findTarget(catalog, key);
      if (!found) throw new Error(`名录里没有: ${key}`);
      pushUnique(selected, found);
    }
  }
  return selected;
}

function pushUnique(list, item) {
  if (list.some((row) => row.id === item.id || row.plugin === item.plugin)) return;
  list.push(item);
}

export function loadRankings(path) {
  const document = JSON.parse(readFileSync(path, "utf8"));
  if (!document?.rankings?.total) throw new Error(`总榜文件缺少 rankings.total: ${path}`);
  return document;
}

export async function fetchRankings(url, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json", "user-agent": "dsh-memory-eval" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new Error(`总榜拉取失败: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    if (!text.trimStart().startsWith("{")) {
      throw new Error("总榜返回的不是 JSON");
    }
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `总榜拉不下来（--all-memory 需要能访问 dsheval.ai，或改用 --rankings 本地文件）: ${message}`,
    );
  }
}
