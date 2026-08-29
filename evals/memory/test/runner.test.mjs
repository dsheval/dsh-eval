import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadCatalog } from "../src/catalog.mjs";
import { RpcHttpError } from "../src/host.mjs";
import { loadSuite } from "../src/lib.mjs";
import {
  assertSafeWipe,
  expandWipe,
  preparePackageTarball,
  prepareSourceCheckout,
} from "../src/plugin-ops.mjs";
import { ensureProfile, WEB_BUNDLES } from "../src/profile.mjs";
import {
  baselineBroken,
  expandTargetEnvironment,
  isolatedHomeEnvironment,
  isRetryableHandlerFailure,
  newHistoryEvents,
  planSuite,
  pluginIsolationIssues,
  prepareTargets,
  requiredTargetEnvironment,
  runSuite,
  runTaskWithHandlerFailureRetry,
  selectTasks,
  startTarget,
} from "../src/suite-runner.mjs";

test("dry-run 计划对每个目标走同一套，不写死 P1–P8", async () => {
  const catalog = loadCatalog();
  const suite = loadSuite();
  const targets = await prepareTargets(catalog, { plugins: ["mem9"] });
  const tasks = selectTasks(suite, ["T1", "T8"]);
  const plan = planSuite({
    catalog,
    suite,
    targets,
    tasks,
    profile: catalog.profile,
    port: catalog.port,
  });
  assert.deepEqual(plan.targets, ["C0", "P1"]);
  assert.ok(plan.steps.includes("C0 install none"));
  assert.ok(plan.steps.includes("P1 install @mem9/dsh-plugin@0.1.0"));
  assert.ok(plan.steps.includes("C0 T1 reset → seed → close-session → probe → score"));
  assert.ok(plan.steps.includes("P1 T8 reset → seed → kill-dsh → probe → score"));
  assert.ok(!plan.steps.some((step) => step.includes("P2 ")));
});

test("locomo20 dry-run 只跑 C0 的 L01–L20", async () => {
  const catalog = loadCatalog();
  const suite = loadSuite("fixtures/locomo20.json");
  const targets = await prepareTargets(catalog, { plugins: ["none"] });
  const tasks = selectTasks(suite);
  const plan = planSuite({
    catalog,
    suite,
    targets,
    tasks,
    profile: catalog.profile,
    port: catalog.port,
  });
  assert.deepEqual(plan.targets, ["C0"]);
  assert.equal(plan.tasks.length, 20);
  assert.ok(plan.steps.includes("C0 L01 reset → seed → close-session → probe → score"));
  assert.ok(plan.steps.includes("C0 L20 reset → seed → close-session → probe → score"));
});

test("matched 为每种插件协议配同协议基线", async () => {
  const catalog = loadCatalog();
  const targets = await prepareTargets(catalog, {
    plugins: ["mem9", "dsh-noema"],
    protocol: "matched",
  });
  assert.deepEqual(
    targets.map((target) => `${target.id}:${target.protocol.id}`),
    ["C0:passive", "C0:guided", "P1:passive", "P6:guided"],
  );
});

test("强制协议用于同轨横向对比", async () => {
  const catalog = loadCatalog();
  const targets = await prepareTargets(catalog, {
    plugins: ["dsh-noema"],
    protocol: "passive",
  });
  assert.deepEqual(
    targets.map((target) => `${target.id}:${target.protocol.id}`),
    ["C0:passive", "P6:passive"],
  );
});

test("rerun-scored 必须显式选题且不能与 fresh 混用", async () => {
  const catalog = loadCatalog();
  const suite = loadSuite();
  await assert.rejects(
    () => runSuite({ catalog, suite, dryRun: true, rerunScored: true }),
    /必须配合显式 --tasks/,
  );
  await assert.rejects(
    () =>
      runSuite({
        catalog,
        suite,
        dryRun: true,
        taskIds: ["T1"],
        rerunScored: true,
        fresh: true,
      }),
    /不能同时使用/,
  );
  const planned = await runSuite({
    catalog,
    suite,
    plugins: ["none"],
    dryRun: true,
    taskIds: ["T1"],
    rerunScored: true,
  });
  assert.deepEqual(planned.plan.tasks, ["T1"]);
});

test("C0 跨会话加重启都过才判题废", () => {
  assert.equal(
    baselineBroken([
      { taskId: "T1", answerResult: "成功" },
      { taskId: "T8", answerResult: "成功" },
    ]),
    "C0 跨会话和重启都过了，题废了，整场停",
  );
  assert.equal(
    baselineBroken([
      { taskId: "T1", answerResult: "失败" },
      { taskId: "T5", answerResult: "成功" },
      { taskId: "T6", answerResult: "成功" },
    ]),
    null,
  );
  assert.match(
    baselineBroken(
      Array.from({ length: 8 }, (_, index) => ({
        taskId: `L${String(index + 1).padStart(2, "0")}`,
        answerResult: "成功",
      })),
    ),
    /LoCoMo 题过了 8/,
  );
});

test("wipe 只扩名录路径，越界拒绝", () => {
  const ctx = {
    home: "D:/safe-home",
    profileDir: "D:/safe-home/profiles/memory-eval",
    workspaceA: "D:/safe-ws/a",
    workspaceB: "D:/safe-ws/b",
  };
  const path = expandWipe("{home}/.dsh/mnemon", ctx);
  assert.equal(path, "D:/safe-home/.dsh/mnemon");
  assert.doesNotThrow(() => assertSafeWipe(path, [ctx.home, ctx.workspaceA]));
  assert.throws(() => assertSafeWipe("C:/Windows/System32", [ctx.home]), /越界/);
});

test("固定源码快照缓存命中时零网络并应用兼容补丁", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-eval-source-cache-"));
  const cacheRoot = join(root, "tools", "sources");
  const sourceDir = join(cacheRoot, "P8");
  const pluginDir = join(sourceDir, "dsh-plugin");
  mkdirSync(pluginDir, { recursive: true });
  writeFileSync(join(sourceDir, ".dsh-source-ref"), "fixed-ref\n");
  writeFileSync(join(pluginDir, "package.json"), '{"name":"fixture"}\n');
  writeFileSync(
    join(pluginDir, "index.js"),
    "const definition = {\n  parameters: tool.inputSchema ?? {},\n  execute: async (args, exec) => {},\n}\n",
  );
  const result = await prepareSourceCheckout(
    {
      id: "P8",
      sourceRepo: "https://invalid.example/repo.git",
      sourceSubdir: "dsh-plugin",
      sourceRef: "fixed-ref",
      sourceArchive: "https://invalid.example/source.zip",
      sourceArchiveSha256: "0".repeat(64),
      compatTextOutput: true,
    },
    { env: { DSH_HOME: join(root, "targets", "P8") }, sourceCacheRoot: cacheRoot },
  );
  assert.equal(result.ok, true);
  assert.match(result.output, /cached fixed source snapshot/);
  assert.match(readFileSync(join(pluginDir, "index.js"), "utf8"), /schema: \{ type: 'string' \}/);
});

test("目标环境变量展开稳定工具目录且不写死用户路径", () => {
  const env = expandTargetEnvironment(
    {
      BIN: "{baseHome}/memory-eval-tools/bin.exe",
      DB: "{targetHome}/memory/db.sqlite",
    },
    { baseHome: "D:/base", targetHome: "D:/base/memory-eval-targets/P8" },
  );
  assert.equal(env.BIN, "D:/base/memory-eval-tools/bin.exe");
  assert.equal(env.DB, "D:/base/memory-eval-targets/P8/memory/db.sqlite");
});

test("只把名录声明的插件 Key 传进最小目标环境", () => {
  const env = requiredTargetEnvironment(
    { requiredEnv: ["MEM9_API_KEY"] },
    { MEM9_API_KEY: "dedicated", GITHUB_TOKEN: "must-not-pass" },
  );
  assert.deepEqual(env, { MEM9_API_KEY: "dedicated" });
  assert.deepEqual(isolatedHomeEnvironment("D:/eval/P1"), {
    HOME: "D:/eval/P1",
    USERPROFILE: "D:/eval/P1",
    APPDATA: join("D:/eval/P1", ".appdata", "roaming"),
    LOCALAPPDATA: join("D:/eval/P1", ".appdata", "local"),
    XDG_CACHE_HOME: join("D:/eval/P1", ".cache"),
    XDG_CONFIG_HOME: join("D:/eval/P1", ".config"),
    XDG_DATA_HOME: join("D:/eval/P1", ".local", "share"),
  });
});

test("第三方插件缺少隔离声明或专用凭据时安全拒绝", () => {
  const credentials = join(mkdtempSync(join(tmpdir(), "memory-eval-isolation-")), "credentials.yml");
  writeFileSync(credentials, "credential: short-lived\n");
  assert.equal(pluginIsolationIssues({ add: null }, {}).length, 0);
  assert.equal(pluginIsolationIssues({ add: "pkg@1.0.0" }, {}).length, 2);
  assert.deepEqual(
    pluginIsolationIssues(
      { add: "pkg@1.0.0" },
      { DSH_EVAL_ISOLATED: "1", DSH_EVAL_CREDENTIALS_FILE: credentials },
    ),
    [],
  );
  const dailyHome = mkdtempSync(join(tmpdir(), "memory-eval-daily-home-"));
  const dailyCredentials = join(dailyHome, ".credentials.yaml");
  writeFileSync(dailyCredentials, "credential: daily\n");
  assert.match(
    pluginIsolationIssues(
      { add: "pkg@1.0.0" },
      { DSH_EVAL_ISOLATED: "1", DSH_EVAL_CREDENTIALS_FILE: dailyCredentials },
      { baseHome: dailyHome },
    ).join("\n"),
    /不能指向日常/,
  );
});

test("Host 启动或 smoke 失败会降级为当前目标失败，不抛出中断整批", async () => {
  const bootFailure = await startTarget({
    boot: async () => { throw new Error("boot failed"); },
    smoke: async () => {},
  });
  assert.equal(bootFailure.start, "失败");
  assert.match(bootFailure.error.message, /boot failed/);

  const smokeFailure = await startTarget({
    boot: async () => ({ id: "host" }),
    smoke: async () => { throw new Error("smoke failed"); },
  });
  assert.equal(smokeFailure.start, "失败");
  assert.equal(smokeFailure.host, undefined);
  assert.match(smokeFailure.error.message, /smoke failed/);
});

test("多轮 seed 的完整 history 只累计每轮新增事件", () => {
  const first = [{ event: { id: "u1" } }, { event: { id: "a1" } }];
  const second = [...first, { event: { id: "u2" } }, { event: { id: "a2" } }];
  const third = [...second, { event: { id: "u3" } }, { event: { id: "a3" } }];
  assert.deepEqual(newHistoryEvents([], first), first);
  assert.deepEqual(newHistoryEvents(first, second), second.slice(2));
  assert.deepEqual(newHistoryEvents(second, third), third.slice(4));
});

test("固定包下载后校验 SRI，并缓存通过校验的 tarball", async () => {
  const root = mkdtempSync(join(tmpdir(), "memory-eval-package-cache-"));
  const archive = Buffer.from("pinned package tarball");
  const integrity = `sha512-${createHash("sha512").update(archive).digest("base64")}`;
  let fetches = 0;
  const target = {
    id: "P-test",
    packageTarball: "https://registry.npmjs.org/example/-/example-1.0.0.tgz",
    packageIntegrity: integrity,
  };
  const first = await preparePackageTarball(target, {
    sourceCacheRoot: root,
    fetch: async () => {
      fetches += 1;
      return { ok: true, status: 200, arrayBuffer: async () => archive };
    },
  });
  assert.equal(first.ok, true);
  assert.equal(readFileSync(first.path, "utf8"), archive.toString());
  const cached = await preparePackageTarball(target, {
    sourceCacheRoot: root,
    fetch: async () => { throw new Error("cache should avoid network"); },
  });
  assert.equal(cached.ok, true);
  assert.equal(fetches, 1);

  const rejected = await preparePackageTarball(
    { ...target, id: "P-bad", packageIntegrity: `sha512-${Buffer.alloc(64).toString("base64")}` },
    {
      sourceCacheRoot: root,
      fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => archive }),
    },
  );
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /完整性校验失败/);
});

test("handler failure 会停 Host、清插件和会话、冷启动后整题重跑一次", async () => {
  const calls = [];
  let attempts = 0;
  const firstError = new RpcHttpError("session.create", 500, "handler failure", {
    nonJson: true,
  });
  const execution = await runTaskWithHandlerFailureRetry({
    host: "host-1",
    run: async (host) => {
      attempts += 1;
      calls.push(`run-whole-task:${host}`);
      if (attempts === 1) throw firstError;
      return { host, answer: "ok" };
    },
    stop: async () => calls.push("stop-host"),
    wipe: async () => calls.push("wipe-plugin"),
    resetSessionStore: async () => calls.push("reset-sessions"),
    boot: async () => {
      calls.push("cold-boot");
      return "host-2";
    },
  });
  assert.deepEqual(calls, [
    "run-whole-task:host-1",
    "stop-host",
    "wipe-plugin",
    "reset-sessions",
    "cold-boot",
    "run-whole-task:host-2",
  ]);
  assert.equal(execution.retried, true);
  assert.equal(execution.firstError, firstError);
  assert.deepEqual(execution.value, { host: "host-2", answer: "ok" });
});

test("handler failure 最多整题重跑一次，第二次失败直接上抛", async () => {
  const calls = [];
  let attempts = 0;
  await assert.rejects(
    () =>
      runTaskWithHandlerFailureRetry({
        host: "host-1",
        run: async (host) => {
          attempts += 1;
          calls.push(`run:${host}`);
          throw new RpcHttpError("session.create", 500, "handler failure", {
            nonJson: true,
          });
        },
        stop: async () => calls.push("stop"),
        wipe: async () => calls.push("wipe"),
        resetSessionStore: async () => calls.push("reset"),
        boot: async () => {
          calls.push("boot");
          return "host-2";
        },
      }),
    /handler failure/,
  );
  assert.equal(attempts, 2);
  assert.deepEqual(calls, ["run:host-1", "stop", "wipe", "reset", "boot", "run:host-2"]);
});

test("只重试明确 handler failure 或 HTTP 500 非 JSON，不重试普通结果和普通异常", async () => {
  assert.equal(
    isRetryableHandlerFailure(
      new RpcHttpError("session.create", 500, "temporary upstream failure", { nonJson: true }),
    ),
    true,
  );
  assert.equal(isRetryableHandlerFailure(new Error("handler failure")), true);
  assert.equal(isRetryableHandlerFailure(new Error("模型答案不正确")), false);

  const calls = [];
  const qualityResult = await runTaskWithHandlerFailureRetry({
    host: "host-1",
    run: async () => ({ answer: "错误答案" }),
    stop: async () => calls.push("stop"),
    wipe: async () => calls.push("wipe"),
    resetSessionStore: async () => calls.push("reset"),
    boot: async () => "host-2",
  });
  assert.equal(qualityResult.retried, false);
  assert.deepEqual(calls, []);

  await assert.rejects(
    () =>
      runTaskWithHandlerFailureRetry({
        host: "host-1",
        run: async () => {
          throw new Error("session not found");
        },
        stop: async () => calls.push("unexpected-stop"),
      }),
    /session not found/,
  );
  assert.deepEqual(calls, []);
});

test("评测 profile 写成 web bundles，不抄日常 web", () => {
  const home = mkdtempSync(join(tmpdir(), "dsh-eval-"));
  const created = ensureProfile({ home, name: "memory-eval" });
  const manifest = JSON.parse(readFileSync(join(created.dir, "package.json"), "utf8"));
  assert.deepEqual(manifest.dsh.profile.bundles, WEB_BUNDLES);
});
