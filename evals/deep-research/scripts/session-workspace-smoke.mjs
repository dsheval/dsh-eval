#!/usr/bin/env node
import { createHost, startHost, stopHost, waitReady } from "../src/host.mjs";
import { baseDshHome, ensureProfile, ensureTaskWorkspace, prepareTargetHome } from "../src/profile.mjs";

const port = Number(process.env.DSH_RESEARCH_SMOKE_PORT ?? 3290);
const baseHome = baseDshHome();
const home = process.env.DSH_RESEARCH_SMOKE_HOME || prepareTargetHome(baseHome, "WORKSPACE-SMOKE", { fresh: true });
const profile = ensureProfile(home, process.env.DSH_RESEARCH_SMOKE_PROFILE ?? "research-eval-smoke");
const workspacePath = ensureTaskWorkspace(home, "SMOKE", 1, { fresh: true });
const handle = startHost({ profile: profile.name, port, cwd: home, env: { ...process.env, DSH_HOME: home } });

try {
  await waitReady(handle.baseUrl, { timeoutMs: 120_000 });
  const host = createHost(handle.baseUrl);
  const created = await host.createSession({ cwd: workspacePath });
  const sessionId = created.sessionId ?? created.id;
  const list = await host.listSessions();
  const row = (list.items ?? list.sessions ?? []).find((item) => (item.sessionId ?? item.id) === sessionId);
  const actual = String(row?.cwd ?? row?.workingDirectory ?? "").replace(/\\/g, "/");
  const expected = workspacePath.replace(/\\/g, "/");
  if (actual !== expected) throw new Error(`session cwd 未绑定题目工作区: expected=${expected}, actual=${actual || "<empty>"}`);
  console.log(JSON.stringify({ ok: true, sessionId, cwd: actual }, null, 2));
} catch (error) {
  console.error(handle.output());
  throw error;
} finally {
  await stopHost(handle).catch(() => {});
}
