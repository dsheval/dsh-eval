#!/usr/bin/env node
import { loadConfiguration } from "../src/config.mjs";
import { preflightExecution } from "../src/runner.mjs";

const preflight = preflightExecution(loadConfiguration());
console.log(
  JSON.stringify(
    {
      ok: preflight.ok,
      validation: preflight.validation.ok,
      judge: preflight.judge,
      targets: preflight.targets.map((target) => ({
        id: target.id,
        ok: target.ok,
        platform: target.platform,
        installKind: target.installKind,
        sourceState: target.sourceState,
        runtimeChecks: target.runtimeChecks,
        requiredCredentials: target.requiredCredentials,
      })),
    },
    null,
    2,
  ),
);
if (!preflight.ok) process.exitCode = 1;
