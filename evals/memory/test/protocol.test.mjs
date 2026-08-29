import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCatalog } from "../src/catalog.mjs";
import {
  probePromptForProtocol,
  seedPromptForProtocol,
  withResolvedProtocol,
} from "../src/protocol.mjs";

const catalog = loadCatalog();

test("matched 按插件交互面选择被动或引导协议", () => {
  const mem9 = withResolvedProtocol(catalog.plugins[0], "matched");
  const noema = withResolvedProtocol(catalog.plugins[5], "matched");
  assert.equal(mem9.protocol.id, "passive");
  assert.equal(noema.protocol.id, "guided");
  assert.equal(seedPromptForProtocol("我喜欢蓝色", mem9.protocol), "我喜欢蓝色");
  assert.match(seedPromptForProtocol("我喜欢蓝色", noema.protocol), /持久记忆能力/);
  assert.match(probePromptForProtocol("我喜欢什么颜色？", noema.protocol), /持久记忆检索能力/);
});

test("插件协议补丁被解析到评测目录", () => {
  const memento = withResolvedProtocol(catalog.plugins[6], "matched");
  const noema = withResolvedProtocol(catalog.plugins[5], "matched");
  assert.ok(memento.protocol.patches.some((path) => path.endsWith("dsh-memento-guided.patch.yml")));
  assert.ok(noema.protocol.patches.some((path) => path.endsWith("dsh-noema-isolated.patch.yml")));
});

test("不支持的协议会拒绝而不是静默错测", () => {
  const native = {
    plugin: "dsh-native-reference",
    defaultProtocol: "session-reference",
    supportedProtocols: ["session-reference"],
  };
  assert.throws(() => withResolvedProtocol(native, "guided"), /不支持评测协议/);
});
