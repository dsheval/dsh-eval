import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

const WEB_BUNDLES = ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"];
const PNPM_WORKSPACE = `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n`;

export function baseDshHome() {
  return process.env.DSH_HOME || join(homedir(), ".dsh");
}

export function targetHome(baseHome, targetId) {
  const safe = String(targetId).replace(/[^A-Za-z0-9._-]+/g, "-");
  if (!safe) throw new Error("targetId 不能为空");
  return join(baseHome, "research-eval-targets", safe);
}

export function prepareTargetHome(baseHome, targetId, options = {}) {
  const root = resolve(baseHome, "research-eval-targets");
  const dir = resolve(targetHome(baseHome, targetId));
  assertInside(dir, root);
  if (options.fresh && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const name of [".credentials.yaml", "settings.yaml", ".anonymous-user-id"]) {
    const source = join(baseHome, name);
    const destination = join(dir, name);
    if (existsSync(source) && !existsSync(destination)) {
      copyFileSync(source, destination);
      if (name === ".credentials.yaml" && process.platform !== "win32") chmodSync(destination, 0o600);
    }
  }
  return dir;
}

export function ensureProfile(home, name = "research-eval") {
  const dir = join(home, "profiles", name);
  mkdirSync(dir, { recursive: true });
  const manifestPath = join(dir, "package.json");
  let manifest = {
    name: `dsh-profile-${name}`,
    private: true,
    dependencies: {},
    dsh: { profile: { bundles: [...WEB_BUNDLES] } },
  };
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.dependencies = manifest.dependencies ?? {};
    manifest.dsh = manifest.dsh ?? {};
    manifest.dsh.profile = manifest.dsh.profile ?? {};
    const bundles = manifest.dsh.profile.bundles ?? [];
    manifest.dsh.profile.bundles = [...new Set([...bundles, ...WEB_BUNDLES])];
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(dir, "pnpm-workspace.yaml"), PNPM_WORKSPACE);
  return { home, name, dir };
}

export function ensureTaskWorkspace(home, taskId, attempt = 1, options = {}) {
  const root = resolve(home, "research-eval-workspaces");
  const dir = resolve(root, `${taskId}-attempt-${attempt}`);
  assertInside(dir, root);
  if (options.fresh && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".research-eval-workspace"), `${taskId}\n`);
  return dir;
}

export function credentialState(home, refs, env = process.env) {
  const credentialPath = join(home, ".credentials.yaml");
  const raw = existsSync(credentialPath) ? readFileSync(credentialPath, "utf8") : "";
  const insecurePermissions =
    process.platform !== "win32" && existsSync(credentialPath) && (statSync(credentialPath).mode & 0o077) !== 0;
  return Object.fromEntries(
    refs.map((ref) => {
      if (insecurePermissions) return [ref, "insecure-permissions"];
      const inEnv = Boolean(env[ref]);
      const inFile = new RegExp(`^\\s*${escapeRegExp(ref)}\\s*:`, "m").test(raw);
      return [ref, inEnv || inFile ? "present" : "missing"];
    }),
  );
}

export function credentialValue(home, ref, env = process.env) {
  if (env[ref]) return env[ref];
  const credentialPath = join(home, ".credentials.yaml");
  if (!existsSync(credentialPath)) return null;
  const raw = readFileSync(credentialPath, "utf8");
  const match = raw.match(new RegExp(`^\\s*${escapeRegExp(ref)}\\s*:\\s*(.+?)\\s*$`, "m"));
  if (!match) return null;
  const value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value && value !== "null" ? value : null;
}

function assertInside(path, root) {
  if (path !== root && !path.startsWith(root + sep)) throw new Error(`路径越界: ${path}`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
