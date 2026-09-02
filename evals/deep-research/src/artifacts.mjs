import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".csv", ".tsv", ".html"]);

export function collectWorkspaceArtifacts(workspacePath, options = {}) {
  const root = resolve(workspacePath);
  const maxFiles = options.maxFiles ?? 50;
  const maxCandidates = options.maxCandidates ?? 2_000;
  const maxFileBytes = options.maxFileBytes ?? 2_000_000;
  const maxTextBytes = options.maxTextBytes ?? 120_000;
  const candidates = [];
  const items = [];
  let remainingText = maxTextBytes;
  const textBlocks = [];
  const scoringTextBlocks = [];

  walk(root, 0, options.maxDepth ?? 4, (path) => {
    if (candidates.length >= maxCandidates) return false;
    const rel = relative(root, path);
    if (!rel || rel === ".research-eval-workspace") return true;
    const abs = resolve(path);
    if (abs !== root && !abs.startsWith(root + sep)) return true;
    let info;
    try {
      const linkInfo = lstatSync(abs);
      if (linkInfo.isSymbolicLink() || !linkInfo.isFile()) return true;
      info = statSync(abs);
    } catch {
      return true;
    }
    const extension = extname(abs).toLowerCase();
    const readable = TEXT_EXTENSIONS.has(extension) && info.size <= maxFileBytes;
    const item = { path: rel.replace(/\\/g, "/"), size: info.size, extension, readable, textIncluded: false, abs };
    candidates.push(item);
    return true;
  });

  candidates.sort((left, right) => artifactPriority(left) - artifactPriority(right) || left.path.localeCompare(right.path));
  for (const candidate of candidates.slice(0, maxFiles)) {
    const item = { ...candidate };
    delete item.abs;
    item.scoringEligible = isScoringArtifact(item);
    if (candidate.readable && remainingText > 0) {
      try {
        const text = readFileSync(candidate.abs, "utf8").slice(0, remainingText);
        if (text.trim()) {
          textBlocks.push(`\n\n--- artifact: ${item.path} ---\n${text}`);
          if (item.scoringEligible) scoringTextBlocks.push(`\n\n--- final artifact: ${item.path} ---\n${text}`);
          remainingText -= text.length;
          item.textIncluded = true;
        }
      } catch {
        item.readable = false;
      }
    }
    items.push(item);
  }

  return {
    items,
    text: textBlocks.join(""),
    scoringText: scoringTextBlocks.join(""),
    truncated: remainingText <= 0 || candidates.length > maxFiles,
  };
}

export function applyArtifactCollection(processLedger, collection) {
  return {
    ...processLedger,
    artifacts: {
      ...processLedger.artifacts,
      count: collection.items.length,
      paths: collection.items.map((item) => item.path),
      items: collection.items,
      textCaptured: collection.items.filter((item) => item.textIncluded).length,
      truncated: collection.truncated,
      versioned:
        processLedger.artifacts.versioned ||
        collection.items.some((item) => /(?:^|[/_-])v\d+(?:\.\d+)+|version|版本/i.test(item.path)),
    },
  };
}

function walk(dir, depth, maxDepth, visit) {
  if (depth > maxDepth || !existsSync(dir)) return true;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return true;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && walk(path, depth + 1, maxDepth, visit) === false) return false;
    if (entry.isFile() && visit(path) === false) return false;
  }
  return true;
}

function artifactPriority(item) {
  const reportLike = /(?:^|[/_.-])(final|report|brief|evaluation|analysis|roadmap|deliverable)(?:[/_.-]|$)/iu.test(item.path);
  const extensionRank = [".md", ".txt", ".csv", ".tsv", ".json", ".html"].indexOf(item.extension);
  return (item.readable ? 0 : 100) + (reportLike ? 0 : 10) + (extensionRank < 0 ? 20 : extensionRank);
}

function isScoringArtifact(item) {
  if (!item.readable || /(?:^|[/_.-])(?:evidence|plan|source|raw|notes?|log)(?:[/_.-]|$)/iu.test(item.path)) return false;
  return /(?:^|[/_.-])(?:final|report|brief|evaluation|analysis|roadmap|deliverable)(?:[/_.-]|$)/iu.test(item.path);
}
