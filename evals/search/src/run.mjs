#!/usr/bin/env node
import { join } from "node:path";
import { buildPlan, loadConfiguration, validateConfiguration } from "./config.mjs";
import { EVAL_ROOT } from "./lib.mjs";
import { writeReport } from "./report.mjs";
import { preflightExecution, runSuite } from "./runner.mjs";

const [command = "help", ...args] = process.argv.slice(2);

try {
  const config = loadConfiguration({ suitePath: value(args, "--suite"), catalogPath: value(args, "--catalog") });
  if (command === "validate") {
    printValidation(validateConfiguration(config, { requireFormal: has(args, "--formal") }));
  } else if (command === "plan") {
    console.log(JSON.stringify(buildPlan(config, { targets: values(args, "--target") }), null, 2));
  } else if (command === "preflight") {
    console.log(JSON.stringify(preflightExecution(config, { targets: values(args, "--target"), formal: has(args, "--formal") }), null, 2));
  } else if (command === "run") {
    const interrupt = operatorInterrupt();
    try {
      const result = await runSuite(config, { targets: values(args, "--target"), execute: has(args, "--execute"), signal: interrupt.signal });
      console.log(JSON.stringify({ schedule: result.schedule, batchSummary: result.batchSummary, outputs: result.outputs.map((row) => ({ runId: row.runId, status: row.meta.status, recordCount: row.records.length })) }, null, 2));
      if (result.batchSummary.interrupted) process.exitCode = 130;
    } finally {
      interrupt.dispose();
    }
  } else if (command === "report") {
    const output = join(EVAL_ROOT, "records", "search-report.json");
    const report = writeReport(join(EVAL_ROOT, "records"), output);
    console.log(JSON.stringify({ output, batches: report.batches.length }, null, 2));
  } else {
    help();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function value(args, key) {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : undefined;
}

function values(args, key) {
  const output = [];
  for (let index = 0; index < args.length; index += 1) if (args[index] === key && args[index + 1]) output.push(args[index + 1]);
  return output;
}

function has(args, key) {
  return args.includes(key);
}

function operatorInterrupt() {
  const controller = new AbortController();
  const onSignal = (signal) => {
    if (controller.signal.aborted) return;
    const error = new Error(`测评运行收到 ${signal}，正在取消当前会话并停止 Host`);
    error.code = "RUN_ABORTED";
    controller.abort(error);
  };
  const onSigint = () => onSignal("SIGINT");
  const onSigterm = () => onSignal("SIGTERM");
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
  return {
    signal: controller.signal,
    dispose: () => {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
    },
  };
}

function printValidation(result) {
  if (!result.issues.length) console.log("OK: Hard-12、基线与八插件名录结构有效");
  for (const row of result.issues) console.log(`${row.level.toUpperCase()} ${row.path}: ${row.message}`);
  process.exitCode = result.ok ? 0 : 1;
}

function help() {
  console.log("DSH Search Hard-12 evaluation\n\nSafe/read-only: validate, plan, preflight, report\nExecution is double-locked and is not performed by code generation.");
}
