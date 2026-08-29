import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { expandWipe } from "./plugin-ops.mjs";

export const WORKSPACE_MARKER = ".eval-workspace";

export function isInside(root, target) {
  const base = resolve(root);
  const abs = resolve(target);
  return abs === base || abs.startsWith(base + sep);
}

export function workspaceKeepRels(target, workspaceDir, wipeCtx) {
  const keeps = [];
  for (const template of target?.wipe ?? []) {
    const abs = expandWipe(template, wipeCtx);
    if (!isInside(workspaceDir, abs)) continue;
    const rel = relative(resolve(workspaceDir), resolve(abs));
    if (rel && rel !== WORKSPACE_MARKER) keeps.push(rel);
  }
  return keeps;
}

export function resetWorkspace(dir, options = {}) {
  if (!dir) throw new Error("resetWorkspace 需要目录");
  const root = resolve(dir);
  mkdirSync(root, { recursive: true });
  const keepRels = [...new Set([WORKSPACE_MARKER, ...(options.keepRelPaths ?? [])])];
  const stashRoot = mkdtempSync(join(tmpdir(), "dsh-eval-keep-"));
  const stashed = [];

  for (const rel of keepRels) {
    const from = resolve(root, rel);
    if (!isInside(root, from)) throw new Error(`拒绝保留越界路径: ${rel}`);
    if (!existsSync(from)) continue;
    const dest = join(stashRoot, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(from, dest, { recursive: true });
    stashed.push(rel);
  }

  for (const name of readdirSync(root)) {
    rmSync(join(root, name), { recursive: true, force: true });
  }

  writeFileSync(join(root, WORKSPACE_MARKER), options.marker ?? "a\n");
  for (const rel of stashed) {
    if (rel === WORKSPACE_MARKER) continue;
    const dest = join(root, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(stashRoot, rel), dest, { recursive: true });
  }
  rmSync(stashRoot, { recursive: true, force: true });
  return { dir: root, kept: stashed };
}
