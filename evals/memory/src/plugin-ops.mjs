import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { dshEnv, killProcess, spawnDsh } from "./host.mjs";

const SOURCE_REF_MARKER = ".dsh-source-ref";

export function expandWipe(template, ctx) {
  return template
    .replaceAll("{home}", ctx.home)
    .replaceAll("{profile}", ctx.profileDir)
    .replaceAll("{workspace}", ctx.workspaceA)
    .replaceAll("{workspaceA}", ctx.workspaceA)
    .replaceAll("{workspaceB}", ctx.workspaceB);
}

export function assertSafeWipe(targetPath, roots) {
  const abs = resolve(targetPath);
  const ok = roots.some((root) => {
    const base = resolve(root);
    return abs === base || abs.startsWith(base + sep);
  });
  if (!ok) throw new Error(`拒绝 wipe 越界: ${abs}`);
}

export async function runDshPlugin(args, options = {}) {
  const timeoutMs = options.timeoutMs ?? (Number(process.env.DSH_EVAL_INSTALL_MS) || 300_000);
  return await new Promise((resolvePromise, reject) => {
    const child = spawnDsh(args, { cwd: options.cwd, env: options.env });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk;
    });
    const timer = setTimeout(() => {
      killProcess(child);
      reject(new Error(`dsh 超时: ${args.join(" ")}`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolvePromise({ code: code ?? 1, output });
    });
  });
}

export async function installPlugin(profile, target, options = {}) {
  if (!target.add) return { ok: true, skipped: true, output: "" };
  let addSpec = target.add;
  let sourceOutput = "";
  if (target.packageTarball || target.packageIntegrity) {
    const prepared = await preparePackageTarball(target, options);
    if (!prepared.ok) {
      return { ok: false, skipped: false, output: prepared.output, reason: prepared.reason };
    }
    addSpec = `file:${prepared.path}`;
    sourceOutput = prepared.output;
  } else if (target.sourceRepo && target.sourceSubdir) {
    const prepared = await prepareSourceCheckout(target, options);
    if (!prepared.ok) return { ok: false, skipped: false, output: prepared.output, reason: prepared.reason };
    const sourceInstallMode = target.sourceInstallMode ?? "link";
    if (!new Set(["link", "file"]).has(sourceInstallMode)) {
      return {
        ok: false,
        skipped: false,
        output: prepared.output,
        reason: `不支持的源码安装模式: ${sourceInstallMode}`,
      };
    }
    addSpec = `${sourceInstallMode}:${join(prepared.dir, target.sourceSubdir)}`;
    sourceOutput = prepared.output;
  }
  const result = await runDshPlugin(["plugin", "--profile", profile, "add", addSpec], options);
  const noBundle = /declares no dsh\.bundle/i.test(result.output);
  return {
    ok: result.code === 0 && !noBundle,
    skipped: false,
    output: `${sourceOutput}${result.output}`,
    reason: noBundle ? "安装包没有 dsh.bundle，只是普通依赖" : "",
  };
}

export async function preparePackageTarball(target, options = {}) {
  if (!target.packageTarball || !target.packageIntegrity) {
    return {
      ok: false,
      reason: "固定包安装必须同时提供 packageTarball 与 packageIntegrity",
      output: "",
    };
  }
  let url;
  try {
    url = new URL(target.packageTarball);
  } catch {
    return { ok: false, reason: "固定包 URL 无效", output: "" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "固定包只允许 HTTPS", output: "" };
  }

  const cacheRoot = options.sourceCacheRoot ?? join(dirname(dirname(options.env?.DSH_HOME ?? "")), "memory-eval-tools", "sources");
  if (!options.sourceCacheRoot && !options.env?.DSH_HOME) {
    return { ok: false, reason: "固定包缓存需要 sourceCacheRoot 或独立 DSH_HOME", output: "" };
  }
  const packageRoot = join(cacheRoot, "packages");
  const safeId = String(target.id).replace(/[^A-Za-z0-9._-]+/g, "-");
  if (!safeId) return { ok: false, reason: "固定包目标 id 为空", output: "" };
  const archivePath = join(packageRoot, `${safeId}.tgz`);
  assertCacheTarget(archivePath, packageRoot);
  mkdirSync(packageRoot, { recursive: true });

  if (existsSync(archivePath)) {
    const cached = readFileSync(archivePath);
    if (verifyPackageIntegrity(cached, target.packageIntegrity)) {
      return { ok: true, path: archivePath, output: "Using verified cached package tarball.\n" };
    }
    rmSync(archivePath, { force: true });
  }

  try {
    const fetchImpl = options.fetch ?? fetch;
    const response = await fetchImpl(url, {
      headers: { "user-agent": "dsh-memory-eval" },
      signal: AbortSignal.timeout(options.sourceDownloadTimeoutMs ?? 120_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: `固定包下载失败: ${response.status} ${response.statusText ?? ""}`.trim(),
        output: "",
      };
    }
    const archive = Buffer.from(await response.arrayBuffer());
    if (!verifyPackageIntegrity(archive, target.packageIntegrity)) {
      return { ok: false, reason: "固定包完整性校验失败", output: "" };
    }
    const tempPath = `${archivePath}.${process.pid}.tmp`;
    writeFileSync(tempPath, archive);
    renameSync(tempPath, archivePath);
    return { ok: true, path: archivePath, output: "Downloaded and verified pinned package tarball.\n" };
  } catch (error) {
    return {
      ok: false,
      reason: `固定包不可用: ${error instanceof Error ? error.message : String(error)}`,
      output: "",
    };
  }
}

export function verifyPackageIntegrity(buffer, integrity) {
  const match = /^(sha256|sha384|sha512)-([A-Za-z0-9+/=]+)$/.exec(String(integrity ?? ""));
  if (!match) return false;
  const actual = createHash(match[1]).update(buffer).digest("base64");
  return actual === match[2];
}

export async function prepareSourceCheckout(target, options = {}) {
  const home = options.env?.DSH_HOME;
  if (!home) return { ok: false, reason: "源码子目录安装需要独立 DSH_HOME", output: "" };
  const cacheRoot =
    options.sourceCacheRoot ?? join(dirname(dirname(home)), "memory-eval-tools", "sources");
  const safeId = String(target.id).replace(/[^A-Za-z0-9._-]+/g, "-");
  if (!safeId) return { ok: false, reason: "源码缓存目标 id 为空", output: "" };
  const dir = join(cacheRoot, safeId);
  let output = "";

  mkdirSync(cacheRoot, { recursive: true });

  if (fixedSnapshotReady(dir, target)) {
    output += `Using cached fixed source snapshot ${target.sourceRef}.\n`;
  } else {
    const cached = await checkoutCachedCommit(dir, target, options);
    output += cached.output;
    if (cached.ok) {
      output += `Using cached git commit ${target.sourceRef}.\n`;
    } else {
      let prepared = null;
      if (target.sourceArchive) {
        prepared = await prepareSourceArchive(cacheRoot, dir, target, options);
        output += prepared.output;
      }
      if (!prepared?.ok) {
        const fetched = await prepareGitCheckout(cacheRoot, dir, target, options);
        output += fetched.output;
        if (!fetched.ok) {
          return {
            ok: false,
            reason: fetched.reason ?? prepared?.reason ?? "插件源码获取失败",
            output,
          };
        }
      }
    }
  }

  const pluginDir = join(dir, target.sourceSubdir);
  if (!existsSync(join(pluginDir, "package.json"))) {
    return { ok: false, reason: `插件源码子目录不存在: ${target.sourceSubdir}`, output };
  }
  if (target.compatTextOutput) {
    const entry = join(pluginDir, "index.js");
    const source = readFileSync(entry, "utf8");
    const needle = /(\s+parameters: tool\.inputSchema \?\? \{\},)\r?\n(\s+execute: async \(args, exec\) => \{)/;
    const replacement = "      parameters: tool.inputSchema ?? {},\n      output: {\n        schema: { type: 'string' },\n        render: (_args, value) => [{ type: 'text', text: String(value ?? '') }],\n      },\n      execute: async (args, exec) => {";
    if (!needle.test(source) && !source.includes("schema: { type: 'string' }")) {
      return { ok: false, reason: "DSH 文本输出兼容补丁无法匹配固定源码", output };
    }
    if (needle.test(source)) writeFileSync(entry, source.replace(needle, `\n${replacement}`));
    output += "Applied text-output compatibility shim for current DSH tool contract.\n";
  }
  return { ok: true, dir, output };
}

function fixedSnapshotReady(dir, target) {
  if (!target.sourceRef || !target.sourceSubdir) return false;
  const marker = join(dir, SOURCE_REF_MARKER);
  if (!existsSync(marker) || !existsSync(join(dir, target.sourceSubdir, "package.json"))) return false;
  return readFileSync(marker, "utf8").trim() === target.sourceRef;
}

async function checkoutCachedCommit(dir, target, options) {
  if (!target.sourceRef || !existsSync(join(dir, ".git"))) return { ok: false, output: "" };
  const present = await runProcess("git", ["cat-file", "-e", `${target.sourceRef}^{commit}`], {
    ...options,
    cwd: dir,
  });
  if (present.code !== 0) return { ok: false, output: "" };
  const checked = await runProcess("git", ["checkout", "--force", "--detach", target.sourceRef], {
    ...options,
    cwd: dir,
  });
  return { ok: checked.code === 0, output: checked.output };
}

async function prepareSourceArchive(cacheRoot, dir, target, options) {
  if (!target.sourceArchiveSha256) {
    return { ok: false, reason: "源码快照缺少 SHA-256，拒绝使用", output: "" };
  }
  const tempRoot = mkdtempSync(join(cacheRoot, `.${String(target.id)}-archive-`));
  const archivePath = join(tempRoot, "source.archive");
  try {
    const response = await fetch(target.sourceArchive, {
      headers: { "user-agent": "dsh-memory-eval" },
      signal: AbortSignal.timeout(options.sourceDownloadTimeoutMs ?? 120_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: `源码快照下载失败: ${response.status} ${response.statusText}`,
        output: "",
      };
    }
    const archive = Buffer.from(await response.arrayBuffer());
    const actual = createHash("sha256").update(archive).digest("hex").toUpperCase();
    const expected = String(target.sourceArchiveSha256).replace(/\s+/g, "").toUpperCase();
    if (actual !== expected) {
      return {
        ok: false,
        reason: `源码快照 SHA-256 不匹配: expected ${expected}, got ${actual}`,
        output: "",
      };
    }
    writeFileSync(archivePath, archive);
    const extracted = await runProcess("tar", ["-xf", archivePath, "-C", tempRoot], options);
    if (extracted.code !== 0) {
      return { ok: false, reason: "源码快照解压失败", output: extracted.output };
    }
    const roots = readdirSync(tempRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    if (roots.length !== 1) {
      return { ok: false, reason: "源码快照顶层目录不唯一", output: extracted.output };
    }
    const extractedRoot = join(tempRoot, roots[0].name);
    if (!existsSync(join(extractedRoot, target.sourceSubdir, "package.json"))) {
      return { ok: false, reason: `源码快照缺少子目录: ${target.sourceSubdir}`, output: extracted.output };
    }
    assertCacheTarget(dir, cacheRoot);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    renameSync(extractedRoot, dir);
    writeFileSync(join(dir, SOURCE_REF_MARKER), `${target.sourceRef ?? "archive"}\n`);
    return {
      ok: true,
      output: `${extracted.output}Downloaded and verified fixed source archive ${actual}.\n`,
    };
  } catch (error) {
    return {
      ok: false,
      reason: `源码快照不可用: ${error instanceof Error ? error.message : String(error)}`,
      output: "",
    };
  } finally {
    if (existsSync(tempRoot)) rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function prepareGitCheckout(cacheRoot, dir, target, options) {
  assertCacheTarget(dir, cacheRoot);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let output = "";
  const initialized = await runProcess("git", ["init", "--quiet"], { ...options, cwd: dir });
  output += initialized.output;
  if (initialized.code !== 0) return { ok: false, reason: "插件源码缓存初始化失败", output };
  const remote = await runProcess("git", ["remote", "add", "origin", target.sourceRepo], {
    ...options,
    cwd: dir,
  });
  output += remote.output;
  if (remote.code !== 0) return { ok: false, reason: "插件源码 remote 配置失败", output };
  const ref = target.sourceRef ?? "HEAD";
  const fetched = await runProcess(
    "git",
    ["fetch", "--depth", "1", "--filter=blob:none", "origin", ref],
    { ...options, cwd: dir },
  );
  output += fetched.output;
  if (fetched.code !== 0) return { ok: false, reason: `插件源码版本 ${ref} 获取失败`, output };
  const checked = await runProcess("git", ["checkout", "--force", "--detach", "FETCH_HEAD"], {
    ...options,
    cwd: dir,
  });
  output += checked.output;
  if (checked.code !== 0) return { ok: false, reason: `插件源码版本 ${ref} checkout 失败`, output };
  return { ok: true, output };
}

function assertCacheTarget(dir, cacheRoot) {
  const root = resolve(cacheRoot);
  const target = resolve(dir);
  if (target === root || !target.startsWith(root + sep)) {
    throw new Error(`拒绝修改源码缓存范围外路径: ${target}`);
  }
}

async function runProcess(command, args, options = {}) {
  return await new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: dshEnv(options),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(value);
    };
    const timer = setTimeout(() => {
      killProcess(child);
      finish({ code: 1, output: `${output}${command} 超时\n` });
    }, options.processTimeoutMs ?? (Number(process.env.DSH_EVAL_INSTALL_MS) || 300_000));
    child.stdout?.on("data", (chunk) => (output += chunk));
    child.stderr?.on("data", (chunk) => (output += chunk));
    child.on("error", (error) => finish({ code: 1, output: `${output}${error.message}\n` }));
    child.on("exit", (code) => finish({ code: code ?? 1, output }));
  });
}

export async function removePlugin(profile, name, options = {}) {
  if (!name || name === "none") return { ok: true, skipped: true, output: "" };
  const result = await runDshPlugin(["plugin", "--profile", profile, "remove", name], options);
  return { ok: result.code === 0, skipped: false, output: result.output };
}

export async function removeConflicts(profile, target, options = {}) {
  const notes = [];
  for (const name of target.conflictsWith ?? []) {
    const result = await removePlugin(profile, name, options);
    if (!result.ok) notes.push(`冲突包未卸干净: ${name}`);
  }
  return notes;
}

export function wipePlugin(target, ctx) {
  const notes = [];
  const templates = target.wipe ?? [];
  if (templates.length === 0 && target.add) {
    return { wiped: [], notes: ["未清干净：名录没有 wipe 路径，未盲删"] };
  }
  const roots = [ctx.home, ctx.profileDir, ctx.workspaceA, ctx.workspaceB].filter(Boolean);
  const wiped = [];
  for (const template of templates) {
    const path = expandWipe(template, ctx);
    try {
      assertSafeWipe(path, roots);
      if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
        wiped.push(path);
      }
    } catch (error) {
      notes.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { wiped, notes };
}
