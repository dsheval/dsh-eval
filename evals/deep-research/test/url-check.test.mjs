import assert from "node:assert/strict";
import { test } from "node:test";
import { checkUrl } from "../src/url-check.mjs";

test("URL 检查拒绝本机和私网地址", async () => {
  const local = await checkUrl("http://127.0.0.1/private");
  assert.equal(local.open, false);
  assert.match(local.error, /private|local|loopback/i);
  const privateHost = await checkUrl("https://internal.example/a", { resolveHost: async () => ["10.0.0.5"] });
  assert.equal(privateHost.open, false);
});

test("公开 URL 使用受控 HEAD 检查", async () => {
  let method = "";
  const result = await checkUrl("https://example.com/a", {
    resolveHost: async () => ["93.184.216.34"],
    fetch: async (_url, options) => {
      method = options.method;
      return new Response("", { status: 200 });
    },
  });
  assert.equal(result.open, true);
  assert.equal(method, "HEAD");
});
