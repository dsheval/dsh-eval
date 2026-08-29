import { isAbsolute, join } from "node:path";
import { evalRoot } from "./lib.mjs";

export const PROTOCOLS = {
  passive: {
    id: "passive",
    label: "零提示自动记忆",
    seedInstruction: "",
    probeInstruction: "",
  },
  guided: {
    id: "guided",
    label: "显式持久记忆",
    seedInstruction:
      "评测操作要求：请使用当前环境中已安装的持久记忆能力，落实上面的信息、更新或遗忘请求；完成后只需简短确认。",
    probeInstruction:
      "评测操作要求：回答前请先使用当前环境中已安装的持久记忆检索能力查找相关历史；找不到就明确说不知道。",
  },
  "session-reference": {
    id: "session-reference",
    label: "DSH 显式会话引用",
    seedInstruction: "",
    probeInstruction: "",
  },
};

export function resolveProtocol(target, requested = "matched") {
  const id = requested === "matched"
    ? target.defaultProtocol ?? (target.referenceSeedSession ? "session-reference" : "passive")
    : requested;
  const builtin = PROTOCOLS[id];
  if (!builtin) throw new Error(`未知评测协议: ${id}`);
  if (target.supportedProtocols?.length && !target.supportedProtocols.includes(id)) {
    throw new Error(`${target.plugin} 不支持评测协议 ${id}`);
  }
  const override = target.protocols?.[id] ?? {};
  return {
    ...builtin,
    ...override,
    id,
    patches: [...(target.patches ?? []), ...(override.patches ?? [])].map(resolvePatchPath),
  };
}

export function withResolvedProtocol(target, requested = "matched") {
  return { ...target, protocol: resolveProtocol(target, requested) };
}

export function seedPromptForProtocol(text, protocol) {
  return appendInstruction(text, protocol?.seedInstruction);
}

export function probePromptForProtocol(text, protocol) {
  return appendInstruction(text, protocol?.probeInstruction);
}

function appendInstruction(text, instruction) {
  const body = String(text ?? "");
  const cue = String(instruction ?? "").trim();
  return cue ? `${body}\n\n${cue}` : body;
}

function resolvePatchPath(path) {
  if (isAbsolute(path)) return path;
  return join(evalRoot(), path);
}
