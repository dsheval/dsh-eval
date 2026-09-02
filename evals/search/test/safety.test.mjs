import assert from "node:assert/strict";
import test from "node:test";
import { assertExecutionAuthorized } from "../src/runner.mjs";

test("run is rejected without the CLI execution flag", () => {
  assert.throws(() => assertExecutionAuthorized({ execute: false }), /安全锁/);
});

test("run is rejected without the exact environment confirmation", () => {
  const previous = process.env.DSH_SEARCH_EVAL_EXECUTE;
  delete process.env.DSH_SEARCH_EVAL_EXECUTE;
  try {
    assert.throws(() => assertExecutionAuthorized({ execute: true }), /DSH_SEARCH_EVAL_EXECUTE/);
  } finally {
    if (previous == null) delete process.env.DSH_SEARCH_EVAL_EXECUTE;
    else process.env.DSH_SEARCH_EVAL_EXECUTE = previous;
  }
});
