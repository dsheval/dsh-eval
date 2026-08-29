import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { emptyRecord, evalRoot } from "./lib.mjs";
import { formatProcess, processDelta } from "./observe.mjs";

export function recordsRoot(root = evalRoot()) {
  return join(root, "records");
}

export function jobsDir(root = evalRoot()) {
  return join(recordsRoot(root), "_jobs");
}

export function suiteSlug(suite) {
  const id = suite?.id ?? "";
  if (!id || id === "dsh-memory-eval-v2") return "";
  if (/locomo/i.test(id)) return "locomo20";
  return id.replace(/^dsh-/, "");
}

export function runIdFor(target, day = new Date().toISOString().slice(0, 10), suite) {
  const parts = [day, target.id, target.plugin];
  const protocolId = target.protocol?.id ?? target.defaultProtocol;
  if (protocolId) parts.push(protocolId);
  const extra = suiteSlug(suite);
  if (extra) parts.push(extra);
  return parts.join("-").replace(/[^A-Za-z0-9._-]+/g, "-");
}

export function isScored(record) {
  return record?.answerResult === "成功" || record?.answerResult === "失败" || record?.answerResult === "部分";
}

export function pendingTasks(tasks, existing = {}) {
  return tasks.filter((task) => !isScored(existing[task.id]));
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function loadRunDir(dir) {
  const metaPath = join(dir, "meta.json");
  const progressPath = join(dir, "progress.json");
  const records = {};
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (!/^(T|L)\d+\.json$/i.test(name)) continue;
      const record = readJson(join(dir, name));
      records[record.taskId ?? name.replace(/\.json$/, "")] = record;
    }
  }
  return {
    dir,
    meta: existsSync(metaPath) ? readJson(metaPath) : null,
    progress: existsSync(progressPath) ? readJson(progressPath) : null,
    records,
  };
}

export function openRun(options) {
  const { target, suite, catalog, profile, tester, tasks, fresh } = options;
  if (fresh && options.rerunScored) {
    throw new Error("--fresh 与 --rerun-scored 不能同时使用");
  }
  const root = options.recordsRoot ?? recordsRoot(options.evalRoot);
  const runId = options.runId ?? runIdFor(target, options.day, suite);
  const dir = join(root, runId);
  mkdirSync(dir, { recursive: true });
  const existing = loadRunDir(dir);
  const meta = {
    ...(fresh ? {} : existing.meta ?? {}),
    runId,
    suiteId: suite.id,
    catalogId: catalog.id,
    condition: target.id,
    plugin: target.plugin,
    pluginVersion: existing.meta?.pluginVersion ?? "",
    dshVersion: existing.meta?.dshVersion ?? "",
    profile,
    model: existing.meta?.model ?? "",
    tester: tester || existing.meta?.tester || "",
    createdAt: fresh ? new Date().toISOString() : existing.meta?.createdAt ?? new Date().toISOString(),
    focus: target.focus ?? "",
    protocol: target.protocol ?? (target.defaultProtocol ? { id: target.defaultProtocol } : null),
  };
  writeJson(join(dir, "meta.json"), meta);

  const records = {};
  const rerunTaskIds = new Set((options.rerunScored ? tasks : []).map((task) => task.id));
  for (const task of suite.tasks) {
    const existingRecord = existing.records[task.id];
    const rerunScored = rerunTaskIds.has(task.id) && isScored(existingRecord);
    const prev = fresh || rerunScored ? null : existingRecord;
    const record = prev ?? emptyRecord(task.id);
    records[task.id] = record;
    const path = join(dir, `${task.id}.json`);
    if (fresh || rerunScored || !existsSync(path)) writeJson(path, record);
  }

  return {
    runId,
    dir,
    meta,
    records,
    pending: pendingTasks(tasks, records),
  };
}

export function writeProgress(dir, patch, options = {}) {
  const path = join(dir, "progress.json");
  const prev = existsSync(path) ? readJson(path) : {};
  const next = {
    ...prev,
    ...patch,
    pid: patch.pid ?? process.pid,
    updatedAt: new Date().toISOString(),
  };
  writeJson(path, next);
  const line = `${next.updatedAt}  ${next.step ?? "-"}  ${next.message ?? next.status ?? ""}`;
  appendFileSync(join(dir, "run.log"), `${line}\n`);
  if (options.log !== false) console.log(line);
  return next;
}

export function listRunIds(root = evalRoot()) {
  const dir = recordsRoot(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "_jobs")
    .filter((entry) => existsSync(join(dir, entry.name, "meta.json")))
    .map((entry) => ({
      runId: entry.name,
      mtime: statMtime(join(dir, entry.name, "progress.json")) || statMtime(join(dir, entry.name, "meta.json")),
    }))
    .sort((left, right) => right.mtime - left.mtime)
    .map((item) => item.runId);
}

function statMtime(path) {
  return existsSync(path) ? statSync(path).mtimeMs : 0;
}

export function findBaselineRun(runDir) {
  const loaded = loadRunDir(runDir);
  if (!loaded.meta || loaded.meta.condition === "C0") return null;
  const root = dirname(runDir);
  let names = [];
  try {
    names = readdirSync(root);
  } catch {
    return null;
  }
  const candidates = [];
  for (const name of names) {
    if (name.startsWith("_") || name.startsWith(".")) continue;
    const otherDir = join(root, name);
    try {
      if (!statSync(otherDir).isDirectory()) continue;
    } catch {
      continue;
    }
    const other = loadRunDir(otherDir);
    if (
      other.meta?.condition === "C0" &&
      other.meta?.suiteId === loaded.meta.suiteId &&
      (other.meta?.protocol?.id ?? "passive") === (loaded.meta?.protocol?.id ?? "passive")
    ) {
      candidates.push({
        loaded: other,
        mtime: statMtime(join(otherDir, "progress.json")) || statMtime(join(otherDir, "meta.json")),
      });
    }
  }
  candidates.sort((left, right) => right.mtime - left.mtime);
  return candidates[0]?.loaded ?? null;
}

export function summarizeRun(dir) {
  const loaded = loadRunDir(dir);
  const baseline = findBaselineRun(dir);
  const tasks = Object.keys(loaded.records)
    .sort()
    .map((id) => {
      const record = loaded.records[id];
      const delta = baseline?.records[id]
        ? processDelta(record.process, baseline.records[id].process)
        : null;
      return `${id}  ${record.answerResult ?? "未测"}  ${record.answerReason ?? ""}  ${formatProcess(record.process, delta)}`.trimEnd();
    });
  return {
    runId: loaded.meta?.runId ?? dir,
    condition: loaded.meta?.condition ?? "",
    plugin: loaded.meta?.plugin ?? "",
    protocol: loaded.meta?.protocol?.id ?? "passive",
    status: loaded.progress?.status ?? "unknown",
    step: loaded.progress?.step ?? "",
    message: loaded.progress?.message ?? "",
    pid: loaded.progress?.pid ?? null,
    alive: isPidAlive(loaded.progress?.pid),
    updatedAt: loaded.progress?.updatedAt ?? loaded.meta?.createdAt ?? "",
    tasks,
  };
}

export function writeJob(job, root = evalRoot()) {
  const dir = jobsDir(root);
  mkdirSync(dir, { recursive: true });
  writeJson(join(dir, `${job.jobId}.json`), job);
  writeJson(join(dir, "latest.json"), job);
  return job;
}

export function readLatestJob(root = evalRoot()) {
  const path = join(jobsDir(root), "latest.json");
  if (!existsSync(path)) return null;
  return readJson(path);
}

export function findLiveJob(root = evalRoot()) {
  const job = readLatestJob(root);
  if (job?.pid && isPidAlive(job.pid)) return job;
  return null;
}
