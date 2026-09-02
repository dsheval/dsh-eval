import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { spawnDsh, killProcess } from "./host.mjs";
import { credentialState } from "./profile.mjs";

const AUTOMATIC_INSTALLS = new Set(["none", "dsh-add", "source-add", "source-profile"]);

export function preflightTarget(target, options = {}) {
  const required = credentialState(options.credentialHome, target.requiredCredentialRefs ?? [], options.env);
  const optional = credentialState(options.credentialHome, target.optionalCredentialRefs ?? [], options.env);
  const missingRequired = Object.entries(required).filter(([, state]) => state !== "present").map(([name]) => name);
  const platformCompatible = target.platforms?.includes(process.platform) ?? true;
  const automaticInstall = AUTOMATIC_INSTALLS.has(target.install.kind);
  const source = resolveSource(target, options.env);
  const runtimeChecks = checkRuntime(target, options.env);
  const runtimeReady = Object.values(runtimeChecks).every((state) => state === "ready");
  return {
    ok: platformCompatible && automaticInstall && source.ok && runtimeReady && missingRequired.length === 0,
    platform: process.platform,
    platformCompatible,
    automaticInstall,
    installKind: target.install.kind,
    manualReason: target.install.reason ?? null,
    sourceState: source.state,
    sourcePath: source.path,
    runtimeChecks,
    requiredCredentials: required,
    optionalCredentials: optional,
    missingRequired,
  };
}

export function checkRuntime(target, env = process.env) {
  return Object.fromEntries(
    (target.runtimeChecks ?? []).map((check) => {
      if (check === "node-24") return [check, process.versions.node.split(".")[0] === "24" ? "ready" : "missing"];
      if (check === "dsh-0.1.1-rc.2") {
        const result = spawnSync(process.platform === "win32" ? "dsh.cmd" : "dsh", ["--version"], {
          env: { ...process.env, ...env },
          encoding: "utf8",
          shell: process.platform === "win32",
          timeout: 10_000,
          windowsHide: true,
        });
        return [check, result.status === 0 && /0\.1\.1-rc\.2/.test(`${result.stdout}\n${result.stderr}`) ? "ready" : "missing"];
      }
      if (check === "docker-engine") {
        const result = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
          env: { ...process.env, ...env },
          encoding: "utf8",
          timeout: 10_000,
          windowsHide: true,
        });
        return [check, result.status === 0 && String(result.stdout).trim() ? "ready" : "missing"];
      }
      return [check, "unknown"];
    }),
  );
}

export async function installTarget(profile, target, options = {}) {
  if (target.install.kind === "none") return { ok: true, skipped: true, output: "baseline" };
  if (!AUTOMATIC_INSTALLS.has(target.install.kind)) {
    return { ok: false, skipped: true, code: "MANUAL_REQUIRED", output: target.install.reason ?? "manual install required" };
  }
  const source = resolveSource(target, options.env);
  if (!source.ok) return { ok: false, skipped: true, code: "SOURCE_NOT_READY", output: source.state };

  if (target.install.kind === "source-profile") {
    return await runCommand(
      process.execPath,
      [source.artifactPath, "--profile", profile, "--package", source.path, "--dsh-bin", "dsh"],
      { ...options, cwd: source.path },
    );
  }

  const spec =
    target.install.kind === "source-add"
      ? target.install.useArtifactAsSpec
        ? source.artifactPath
        : source.path
      : target.install.spec;
  const result = await runDsh(["plugin", "--profile", profile, "add", spec], options);
  const noBundle = /declares no dsh\.bundle/i.test(result.output);
  if (result.code === 0 && !noBundle && target.install.verifyPlugin) {
    const verification = await runDsh(["plugin", "--profile", profile, "why", target.install.verifyPlugin], options);
    if (verification.code !== 0) {
      return { ok: false, skipped: false, code: "VERIFY_FAILED", output: `${result.output}\n${verification.output}` };
    }
  }
  return {
    ok: result.code === 0 && !noBundle,
    skipped: false,
    code: noBundle ? "NO_DSH_BUNDLE" : result.code === 0 ? "OK" : `EXIT_${result.code}`,
    output: result.output,
  };
}

export function resolveSource(target, env = process.env) {
  if (!["source-add", "source-profile"].includes(target.install.kind)) {
    return { ok: true, state: "not-required", path: null, artifactPath: null };
  }
  const root = env?.[target.install.rootEnv];
  if (!root) return { ok: false, state: `missing-env:${target.install.rootEnv}`, path: null, artifactPath: null };
  const rootPath = resolve(root);
  const sourcePath = resolve(rootPath, target.install.relativePath);
  const relativeSource = relative(rootPath, sourcePath);
  if (relativeSource.startsWith("..") || isAbsolute(relativeSource)) {
    return { ok: false, state: "source-path-outside-root", path: sourcePath, artifactPath: null };
  }
  const artifactPath = resolve(sourcePath, target.install.artifact);
  const relativeArtifact = relative(sourcePath, artifactPath);
  if (relativeArtifact.startsWith("..") || isAbsolute(relativeArtifact)) {
    return { ok: false, state: "artifact-path-outside-source", path: sourcePath, artifactPath };
  }
  return existsSync(artifactPath)
    ? { ok: true, state: "ready", path: sourcePath, artifactPath }
    : { ok: false, state: `missing-artifact:${target.install.artifact}`, path: sourcePath, artifactPath };
}

export async function runDsh(args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 600_000;
  return await new Promise((resolve, reject) => {
    const child = spawnDsh(args, { cwd: options.cwd, env: options.env });
    let output = "";
    child.stdout?.on("data", (chunk) => (output += chunk));
    child.stderr?.on("data", (chunk) => (output += chunk));
    const timer = setTimeout(() => {
      killProcess(child);
      reject(new Error(`dsh 命令超时: ${args.join(" ")}`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output: redact(output) });
    });
  });
}

async function runCommand(file, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 600_000;
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    child.stdout?.on("data", (chunk) => (output += chunk));
    child.stderr?.on("data", (chunk) => (output += chunk));
    const timer = setTimeout(() => {
      killProcess(child);
      reject(new Error(`安装命令超时: ${file}`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolvePromise({
        ok: code === 0,
        skipped: false,
        code: code === 0 ? "OK" : `EXIT_${code ?? 1}`,
        output: redact(output),
      });
    });
  });
}

function redact(text) {
  return String(text)
    .replace(/(api[_-]?key|authorization|secret|token)(\s*[:=]\s*)\S+/gi, "$1$2[REDACTED]")
    .slice(0, 100_000);
}
