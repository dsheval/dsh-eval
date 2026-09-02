#!/usr/bin/env node
import { join } from "node:path";
import { buildPlan, loadConfiguration, validateConfiguration } from "./config.mjs";
import { EVAL_ROOT } from "./lib.mjs";
import { writeLeaderboard } from "./report.mjs";
import { preflightExecution, runSuite } from "./runner.mjs";

const [command = "help", ...args] = process.argv.slice(2);

try {
  if (command === "validate") {
    const config = loadFromArgs(args);
    const result = validateConfiguration(config, { requireRunnable: has(args, "--strict") });
    printIssues(result);
    process.exitCode = result.ok ? 0 : 1;
  } else if (command === "plan") {
    const config = loadFromArgs(args);
    const targets = values(args, "--target");
    const tasks = values(args, "--task");
    const judge = judgeOption(args);
    const plan = buildPlan(config, { targets, tasks, judge });
    const preflight = preflightExecution(config, { targets, tasks, judge });
    console.log(JSON.stringify({ plan, preflight }, null, 2));
  } else if (command === "run") {
    const config = loadFromArgs(args);
    const result = await runSuite(config, {
      targets: values(args, "--target"),
      tasks: values(args, "--task"),
      judge: judgeOption(args),
      stability: has(args, "--stability"),
      fresh: !has(args, "--no-fresh"),
      execute: has(args, "--execute"),
    });
    console.log(JSON.stringify(result, null, 2));
  } else if (command === "report") {
    const recordsRoot = join(EVAL_ROOT, "records");
    const output = join(recordsRoot, "leaderboard.json");
    const document = writeLeaderboard(recordsRoot, output);
    console.log(JSON.stringify({ output, count: document.leaderboard.length }, null, 2));
  } else {
    printHelp();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function loadFromArgs(args) {
  return loadConfiguration({
    suitePath: value(args, "--suite"),
    catalogPath: value(args, "--catalog"),
    privatePath: value(args, "--private-tasks"),
  });
}

function value(args, key) {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : undefined;
}

function values(args, key) {
  const output = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === key && args[index + 1]) output.push(args[index + 1]);
  }
  return output;
}

function has(args, key) {
  return args.includes(key);
}

function judgeOption(args) {
  const enabled = has(args, "--judge");
  const disabled = has(args, "--no-judge");
  if (enabled && disabled) throw new Error("--judge 与 --no-judge 不能同时使用");
  if (enabled) return true;
  if (disabled) return false;
  return undefined;
}

function printIssues(result) {
  if (!result.issues.length) console.log("OK: 规则、题集和名录结构有效");
  for (const issue of result.issues) console.log(`${issue.level.toUpperCase()} ${issue.path}: ${issue.message}`);
}

function printHelp() {
  console.log(`DSH Deep Research evaluation\n\nSafe commands:\n  node src/run.mjs validate\n  node src/run.mjs plan\n  node src/run.mjs report\n\nSelectors:\n  --target P1   select one condition (repeatable)\n  --task R3     select one task (repeatable; intended for audited refresh runs)\n\nLong-form Judge is enabled by default; use --no-judge only for an explicit ungraded diagnostic run.\nFormal execution is locked. See DEVELOPMENT.md.`);
}
