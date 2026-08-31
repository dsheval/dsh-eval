import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { killProcess, spawnDsh } from "./host.mjs";
import { credentialState } from "./profile.mjs";

const AUTOMATIC_INSTALLS = new Set(["none", "dsh-add", "source-link"]);

export function preflightTarget(target, options = {}) {
  const requiredCredentials = credentialState(options.credentialHome, target.requiredCredentialRefs ?? [], options.env);
  const optionalCredentials = credentialState(options.credentialHome, target.optionalCredentialRefs ?? [], options.env);
  const missingRequired = Object.entries(requiredCredentials).filter(([, state]) => state === "missing").map(([name]) => name);
  const source = resolveSource(target, options.env);
  const commit = source.ok && target.install.kind === "source-link" ? verifySourceCommit(source.path, target.install.expectedCommit) : { ok: true, actual: null };
  const platformCompatible = target.platforms?.includes(process.platform) ?? true;
  return {
    ok: platformCompatible && AUTOMATIC_INSTALLS.has(target.install.kind) && source.ok && commit.ok && missingRequired.length === 0,
    platform: process.platform,
    platformCompatible,
    automaticInstall: AUTOMATIC_INSTALLS.has(target.install.kind),
    installKind: target.install.kind,
    sourceState: source.state,
    sourcePath: source.path,
    sourceCommit: commit.actual,
    sourceCommitMatches: commit.ok,
    requiredCredentials,
    optionalCredentials,
    missingRequired,
  };
}

export async function installTarget(profileName, target, options = {}) {
  if (target.install.kind === "none") return { ok: true, skipped: true, code: "BASELINE", output: "" };
  const source = resolveSource(target, options.env);
  if (!source.ok) return { ok: false, skipped: true, code: "SOURCE_NOT_READY", output: source.state };
  const specs = target.install.kind === "source-link"
    ? [`link:${source.path}`]
    : target.install.specs;
  const result = await runDsh(["plugin", "--profile", profileName, "add", ...specs], options);
  const noBundle = /declares no dsh\.bundle/iu.test(result.output);
  return {
    ok: result.code === 0 && !noBundle,
    skipped: false,
    code: noBundle ? "NO_DSH_BUNDLE" : result.code === 0 ? "OK" : `EXIT_${result.code}`,
    output: result.output,
  };
}

export function resolveSource(target, env = process.env) {
  if (target.install.kind !== "source-link") return { ok: true, state: "not-required", path: null, artifactPath: null };
  const root = env[target.install.rootEnv];
  if (!root) return { ok: false, state: `missing-env:${target.install.rootEnv}`, path: null, artifactPath: null };
  const rootPath = resolve(root);
  const sourcePath = resolve(rootPath, target.install.relativePath);
  if (outside(rootPath, sourcePath)) return { ok: false, state: "source-path-outside-root", path: sourcePath, artifactPath: null };
  const artifactPath = resolve(sourcePath, target.install.artifact);
  if (outside(sourcePath, artifactPath)) return { ok: false, state: "artifact-path-outside-source", path: sourcePath, artifactPath };
  return existsSync(artifactPath)
    ? { ok: true, state: "ready", path: sourcePath, artifactPath }
    : { ok: false, state: `missing-artifact:${target.install.artifact}`, path: sourcePath, artifactPath };
}

export function verifySourceCommit(sourcePath, expected) {
  try {
    const actual = execFileSync("git", ["-C", sourcePath, "rev-parse", "HEAD"], { encoding: "utf8", timeout: 10_000, windowsHide: true }).trim();
    return { ok: actual === expected, actual };
  } catch {
    return { ok: false, actual: null };
  }
}

function outside(root, child) {
  const rel = relative(root, child);
  return rel.startsWith("..") || isAbsolute(rel);
}

async function runDsh(args, options = {}) {
  return await new Promise((resolvePromise, reject) => {
    const child = spawnDsh(args, { cwd: options.cwd, env: options.env });
    let output = "";
    child.stdout?.on("data", (chunk) => (output += chunk));
    child.stderr?.on("data", (chunk) => (output += chunk));
    const timer = setTimeout(() => {
      killProcess(child);
      reject(new Error(`dsh 命令超时: ${args.join(" ")}`));
    }, options.timeoutMs ?? 600_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolvePromise({ code: code ?? 1, output: redact(output) });
    });
  });
}

function redact(text) {
  return String(text)
    .replace(/(api[_-]?key|authorization|secret|token)(\s*[:=]\s*)\S+/giu, "$1$2[REDACTED]")
    .slice(0, 100_000);
}
