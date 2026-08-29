#!/usr/bin/env node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfiguration } from "../src/config.mjs";
import { installTarget, preflightTarget } from "../src/plugin.mjs";
import { ensureProfile } from "../src/profile.mjs";

const targetId = String(process.argv[2] ?? "").toUpperCase();
if (!["P1", "P3"].includes(targetId)) {
  console.error("Usage: node scripts/admission-smoke.mjs P1|P3");
  process.exit(2);
}

const config = loadConfiguration();
const target = config.catalog.plugins.find((item) => item.id === targetId);
const home = mkdtempSync(join(tmpdir(), `dsh-research-eval-${targetId.toLowerCase()}-`));
const env = { ...process.env, DSH_HOME: home };
const admission = preflightTarget(target, { credentialHome: home, env });
const runtimeReady = Object.values(admission.runtimeChecks).every((state) => state === "ready");
if (!admission.platformCompatible || !admission.automaticInstall || admission.sourceState !== "ready" || !runtimeReady) {
  console.error(JSON.stringify({ target: targetId, home, admission }, null, 2));
  process.exit(1);
}

const profile = ensureProfile(home, config.catalog.profile);
const result = await installTarget(profile.name, target, { cwd: home, env, timeoutMs: 600_000 });
console.log(JSON.stringify({ target: targetId, home, profile: profile.name, ok: result.ok, code: result.code }, null, 2));
if (!result.ok) {
  console.error(result.output);
  process.exitCode = 1;
}
