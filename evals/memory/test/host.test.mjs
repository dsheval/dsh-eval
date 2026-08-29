import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import {
  buildRequest,
  dshEnv,
  lastAssistantText,
  parseResponse,
  requestGracefulShutdown,
  rpc,
  RpcHttpError,
  waitProcessExit,
} from "../src/host.mjs";

test("RPC 信封 path 与 method 对齐", () => {
  const request = buildRequest("session.create", { cwd: "/tmp/ws" }, "rpc-1");
  assert.deepEqual(request, {
    type: "client-request",
    rpcId: "rpc-1",
    method: "session.create",
    payload: { cwd: "/tmp/ws" },
  });
});

test("成功信封取出 value，业务失败抛错", () => {
  assert.deepEqual(
    parseResponse(
      {
        type: "server-response",
        rpcId: "rpc-1",
        result: { ok: true, value: { sessionId: "s1" } },
      },
      "rpc-1",
    ),
    { sessionId: "s1" },
  );
  assert.throws(
    () =>
      parseResponse({
        type: "server-response",
        rpcId: "rpc-2",
        result: { ok: false, error: { message: "workspace not found" } },
      }),
    /workspace not found/,
  );
});

test("history 取最后一条助手文本", () => {
  const text = lastAssistantText([
    { event: { type: "user/message", data: { content: [{ type: "text", text: "hi" }] } } },
    {
      event: {
        type: "assistant/message",
        data: {
          turn: 1,
          step: 1,
          message: {
            role: "assistant",
            content: [
              { type: "reasoning", text: "推理里提到别的工号 DSH-9999 不算数" },
              { type: "text", text: "工号 DSH-1742，偏好 Go" },
            ],
          },
        },
      },
    },
  ]);
  assert.equal(text, "工号 DSH-1742，偏好 Go");
});

test("rpc 走 /api/<method> 且拒绝非环回", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          type: "server-response",
          rpcId: JSON.parse(init.body).rpcId,
          result: { ok: true, value: { items: [] } },
        }),
    };
  };
  await rpc("http://127.0.0.1:3180", "session.list", {}, { fetch: fetchImpl });
  assert.equal(calls[0].url, "http://127.0.0.1:3180/api/session.list");
  assert.equal(JSON.parse(calls[0].init.body).method, "session.list");
  await assert.rejects(
    () => rpc("http://example.com:3180", "session.list", {}, { fetch: fetchImpl }),
    /环回/,
  );
});

test("rpc 非 JSON 响应保留 HTTP 状态和原始正文", async () => {
  await assert.rejects(
    () =>
      rpc("http://127.0.0.1:3180", "session.create", {}, {
        fetch: async () => ({
          ok: false,
          status: 500,
          text: async () => "handler failure",
        }),
      }),
    (error) => {
      assert.ok(error instanceof RpcHttpError);
      assert.equal(error.status, 500);
      assert.equal(error.body, "handler failure");
      assert.equal(error.nonJson, true);
      assert.match(error.message, /HTTP 500 session\.create non-JSON: handler failure/);
      return true;
    },
  );
});

test("expose-internals 只能当 node 参数，不能写进 NODE_OPTIONS", () => {
  const env = dshEnv({ env: { NODE_OPTIONS: "--max-old-space-size=64" } });
  assert.doesNotMatch(env.NODE_OPTIONS ?? "", /expose-internals/);
});

test("优雅关闭只请求环回控制端点并携带一次性令牌", async () => {
  const calls = [];
  await requestGracefulShutdown(13180, "secret", {
    fetch: async (url, init) => {
      calls.push({ url, init });
      return { status: 202 };
    },
  });
  assert.equal(calls[0].url, "http://127.0.0.1:13180/shutdown");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.authorization, "Bearer secret");
});

test("优雅关闭会等待 DSH 进程真正退出", async () => {
  const child = new EventEmitter();
  child.pid = 42;
  child.exitCode = null;
  child.signalCode = null;
  setImmediate(() => {
    child.exitCode = 0;
    child.emit("exit", 0, null);
  });
  await waitProcessExit(child, 100);
});
