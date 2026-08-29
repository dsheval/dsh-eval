#!/usr/bin/env node
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultCatalogPath, findTarget, loadCatalog } from "./catalog.mjs";
import {
  emptyRecord,
  evalRoot,
  getTask,
  loadSuite,
  scoreAnswer,
  seedLines,
} from "./lib.mjs";
import {
  findLiveJob,
  isPidAlive,
  jobsDir,
  listRunIds,
  readLatestJob,
  runIdFor,
  summarizeRun,
  writeJob,
} from "./progress.mjs";
import { describeCatalog, runSuite } from "./suite-runner.mjs";
import {
  probePromptForProtocol,
  seedPromptForProtocol,
  withResolvedProtocol,
} from "./protocol.mjs";

const usage = `用法:
  node src/run.mjs new --condition C0|P1|插件名 [--plugin 覆盖包名] [--tester 名字]
  node src/run.mjs prompt <runId> <T1-T8> [seed|probe]
  node src/run.mjs score <runId> <T1-T8> --answer "回答原文" [--dumped]
  node src/run.mjs summary <runId>
  node src/run.mjs status [runId]
  node src/run.mjs suite [--catalog 路径] [--plugins mem9,dsh-mnemon] [--all-memory]
                         [--rankings 本地总榜.json] [--suite fixtures/locomo20.json]
                         [--tasks T1,T8] [--dry-run]
                         [--protocol matched|passive|guided|both|session-reference]
                         [--no-host] [--keep-host] [--tester 名字] [--port 3180]
                         [--no-baseline] [--detach] [--fresh|--rerun-scored] [--day YYYY-MM-DD] [--force]
`;

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function flag(name) {
  return process.argv.includes(name);
}

function csv(name) {
  const value = arg(name);
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function recordsDir() {
  return join(evalRoot(), "records");
}

function runPath(runId) {
  return join(recordsDir(), runId);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function cmdNew() {
  const suite = loadSuite(arg("--suite"));
  const catalog = loadCatalog(arg("--catalog", defaultCatalogPath()));
  const condition = arg("--condition", "C0");
  const found = findTarget(catalog, condition);
  const spec = found ? withResolvedProtocol(found, arg("--protocol", "matched")) : null;
  if (!spec) throw new Error(`未知条件: ${condition}（名录: ${describeCatalog(catalog)}）`);
  const plugin = arg("--plugin", spec.plugin);
  const tester = arg("--tester", "");
  const runId = runIdFor({ ...spec, plugin }, undefined, suite);
  const dir = runPath(runId);
  mkdirSync(dir, { recursive: true });
  writeJson(join(dir, "meta.json"), {
    runId,
    suiteId: suite.id,
    catalogId: catalog.id,
    condition: spec.id,
    plugin,
    pluginVersion: "",
    dshVersion: "",
    profile: catalog.profile,
    model: "",
    tester,
    createdAt: new Date().toISOString(),
    focus: spec.focus ?? "",
    protocol: spec.protocol,
  });
  for (const task of suite.tasks) {
    writeJson(join(dir, `${task.id}.json`), emptyRecord(task.id));
  }
  console.log(runId);
}

function cmdPrompt() {
  const [, , , runId, taskId, phase = "seed"] = process.argv;
  if (!runId || !taskId) throw new Error(usage);
  const suite = loadSuite(arg("--suite"));
  const task = getTask(suite, taskId);
  const catalog = loadCatalog(arg("--catalog", defaultCatalogPath()));
  const meta = readJson(join(runPath(runId), "meta.json"));
  const found = findTarget(catalog, meta.condition ?? meta.plugin);
  const target = found
    ? withResolvedProtocol(found, meta.protocol?.id ?? arg("--protocol", "matched"))
    : { protocol: meta.protocol ?? { id: "passive" } };
  if (phase === "probe") {
    console.log(probePromptForProtocol(task.probe, target.protocol));
    if (task.note) console.error(`注意: ${task.note}`);
    console.error(`屏障: ${task.barrier}`);
    return;
  }
  for (const line of seedLines(task)) console.log(seedPromptForProtocol(line, target.protocol));
  if (task.note) console.error(`注意: ${task.note}`);
}

function cmdScore() {
  const [, , , runId, taskId] = process.argv;
  if (!runId || !taskId) throw new Error(usage);
  const suite = loadSuite(arg("--suite"));
  const task = getTask(suite, taskId);
  const answer = arg("--answer");
  const path = join(runPath(runId), `${taskId}.json`);
  const record = readJson(path);
  record.answer = answer;
  if (flag("--dumped")) record.process.dumpedAllNoise = true;
  const scored = scoreAnswer(task, answer, record.process);
  record.answerResult = scored.result;
  record.answerReason = scored.reason;
  writeJson(path, record);
  console.log(`${taskId} ${scored.result}  ${scored.reason}`);
}

function cmdSummary() {
  const runId = process.argv[3] ?? listRunIds()[0];
  if (!runId) throw new Error("还没有轮次记录");
  printSummary(runId);
}

function printSummary(runId) {
  const summary = summarizeRun(runPath(runId));
  const alive = summary.alive ? "在跑" : "已停";
  console.log(`${summary.runId}  ${summary.condition}  ${summary.plugin}  ${summary.status}  ${alive}`);
  if (summary.step || summary.message) console.log(`${summary.step}  ${summary.message}`.trim());
  for (const line of summary.tasks) console.log(line);
}

function cmdStatus() {
  const requested = process.argv[3];
  const job = readLatestJob();
  if (job) {
    const alive = isPidAlive(job.pid) ? "在跑" : "已停";
    console.log(`job ${job.jobId}  pid ${job.pid ?? "-"}  ${alive}`);
    if (job.log) console.log(`log ${job.log}`);
    if (job.argv?.length) console.log(job.argv.join(" "));
  }
  const runId = requested ?? listRunIds()[0];
  if (!runId) {
    if (!job) console.log("还没有轮次记录");
    return;
  }
  printSummary(runId);
}

function cmdDetach() {
  const live = findLiveJob();
  if (live && !flag("--force")) {
    throw new Error(`已有评测在跑 pid ${live.pid}，先 status 或加 --force`);
  }
  const args = process.argv.slice(2).filter((item) => item !== "--detach");
  const jobId = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(jobsDir(), { recursive: true });
  const logPath = join(jobsDir(), `${jobId}.log`);
  const fd = openSync(logPath, "a");
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...args], {
    detached: true,
    stdio: ["ignore", fd, fd],
    cwd: evalRoot(),
    env: { ...process.env, DSH_EVAL_JOB: jobId },
    windowsHide: true,
  });
  closeSync(fd);
  writeJob({
    jobId,
    pid: child.pid,
    log: logPath,
    argv: args,
    startedAt: new Date().toISOString(),
  });
  child.unref();
  console.log(jobId);
  console.log(`pid ${child.pid}`);
  console.log(`log ${logPath}`);
  console.log("查进度: node src/run.mjs status");
}

async function cmdSuite() {
  if (flag("--detach")) {
    cmdDetach();
    return;
  }
  if (!flag("--dry-run") && !flag("--force")) {
    const live = findLiveJob();
    if (live && live.pid !== process.pid) {
      throw new Error(`已有评测在跑 pid ${live.pid}，先 status 或加 --force`);
    }
  }

  const catalog = loadCatalog(arg("--catalog", defaultCatalogPath()));
  const suite = loadSuite(arg("--suite"));
  const taskIds = csv("--tasks");
  const rerunScored = flag("--rerun-scored");
  if (rerunScored && taskIds.length === 0) {
    throw new Error("--rerun-scored 必须配合显式 --tasks 使用");
  }
  if (rerunScored && flag("--fresh")) {
    throw new Error("--fresh 与 --rerun-scored 不能同时使用");
  }
  if (!flag("--dry-run")) {
    writeJob({
      jobId: process.env.DSH_EVAL_JOB ?? new Date().toISOString().replace(/[:.]/g, "-"),
      pid: process.pid,
      log: null,
      argv: process.argv.slice(2),
      startedAt: new Date().toISOString(),
    });
  }
  const requestedProtocol = arg("--protocol", "matched");
  const protocolRuns = requestedProtocol === "both"
    ? ["passive", "guided"]
    : [requestedProtocol];
  const sharedOptions = {
    catalog,
    suite,
    plugins: csv("--plugins"),
    taskIds,
    allMemory: flag("--all-memory") || Boolean(arg("--rankings")),
    rankingsPath: arg("--rankings"),
    dryRun: flag("--dry-run"),
    noHost: flag("--no-host"),
    keepHost: flag("--keep-host"),
    noBaseline: flag("--no-baseline"),
    tester: arg("--tester"),
    port: arg("--port") ? Number(arg("--port")) : catalog.port,
    profile: arg("--profile", catalog.profile),
    baseUrl: arg("--url") || process.env.DSH_EVAL_URL,
    fresh: flag("--fresh"),
    rerunScored,
    day: arg("--day") || undefined,
  };
  const results = [];
  for (const protocol of protocolRuns) {
    results.push(await runSuite({ ...sharedOptions, protocol }));
  }

  if (flag("--dry-run")) {
    for (const result of results) {
      console.log(
        `${result.plan.profile} :${result.plan.port}  ${result.plan.targets.join(",")}  ${result.plan.tasks.join(",")}`,
      );
      for (const step of result.plan.steps) console.log(step);
    }
    return;
  }

  for (const run of results.flatMap((result) => result.runs)) {
    console.log(`${run.runId}  ${run.target.id}  ${run.target.plugin}`);
    for (const record of run.records) {
      console.log(`${record.taskId}  ${record.answerResult ?? "未测"}  ${record.answerReason ?? ""}`);
    }
    if (run.notes.length) console.log(run.notes.join("\n"));
  }
}

const command = process.argv[2];
try {
  if (command === "new") cmdNew();
  else if (command === "prompt") cmdPrompt();
  else if (command === "score") cmdScore();
  else if (command === "summary") cmdSummary();
  else if (command === "status") cmdStatus();
  else if (command === "suite") await cmdSuite();
  else throw new Error(usage);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
