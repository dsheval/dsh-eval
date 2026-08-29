import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function evalRoot() {
  return root;
}

export function defaultSuitePath() {
  return join(root, "fixtures", "suite.json");
}

export function resolveSuitePath(path) {
  if (!path) return defaultSuitePath();
  if (isAbsolute(path)) return path;
  return join(root, path);
}

export function loadSuite(path) {
  return JSON.parse(readFileSync(resolveSuitePath(path), "utf8"));
}

export function getTask(suite, taskId) {
  const task = suite.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`未知题号: ${taskId}`);
  return task;
}

export function seedLines(task) {
  if (task.id === "T7") return [...task.noiseSeeds, task.usefulSeed];
  return task.seeds;
}

function has(text, token) {
  return text.toLowerCase().includes(String(token).toLowerCase());
}

function hasGo(text) {
  return /(?<![A-Za-z])Go(?![A-Za-z])/i.test(text) || /golang/i.test(text);
}

function abstained(text) {
  return /不知道|不了解|未提过|没有提过|无从得知|没有这类|没说过|无法确定|不记得|\b(?:i\s+(?:do\s+not|don't)\s+know|i\s+(?:could\s+not|couldn't)\s+find|no\s+(?:information|record|context)|not\s+(?:enough|sufficient)\s+(?:information|context)|cannot\s+(?:determine|answer)|can't\s+(?:determine|answer)|unknown)\b/i.test(text);
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasToken(text, token) {
  const needle = String(token).trim();
  if (!needle) return false;
  if (/^(yes|no)$/i.test(needle) || /^\d{4}$/.test(needle)) {
    return new RegExp(`(?<![A-Za-z0-9])${escapeRe(needle)}(?![A-Za-z0-9])`, "i").test(text);
  }
  return has(text, needle);
}

function scoreMarked(task, text) {
  if (abstained(text)) {
    return { result: "失败", reason: "明确拒答，不能靠复述题目关键词得分" };
  }
  if (task?.process?.sessionReferenceCount > 0 && task?.process?.allowSessionReferences !== true) {
    return { result: "失败", reason: "检测到 DSH 历史会话注入" };
  }
  const tokens = (task.must_include ?? []).filter(Boolean);
  const probe = String(task.probe ?? "");
  const usableTokens = tokens.filter((token) => !hasToken(probe, token));
  const tokenHit = usableTokens.length > 0 && usableTokens.every((token) => hasToken(text, token));
  const goldHit = (task.answers ?? []).some((gold) => {
    const value = String(gold ?? "").trim();
    if (!value) return false;
    return value.length <= 4 ? hasToken(text, value) : has(text, value);
  });
  if (tokenHit || goldHit) {
    return { result: "成功", reason: goldHit ? "命中标准答案" : "命中 must_include" };
  }
  return { result: "失败", reason: "未命中标准答案或记号" };
}

export function scoreAnswer(task, answer, process = {}) {
  const text = String(answer ?? "").trim();
  if (!text) {
    return { result: "失败", reason: "没有回答" };
  }

  if (Array.isArray(task.must_include) || Array.isArray(task.answers)) {
    return scoreMarked({ ...task, process }, text);
  }

  switch (task.id) {
    case "T1":
    case "T8":
      if (has(text, "DSH-1742") && hasGo(text)) {
        return { result: "成功", reason: "工号和 Go 都命中" };
      }
      return { result: "失败", reason: "缺少 DSH-1742 或 Go" };
    case "T2":
      if (has(text, "pnpm")) return { result: "成功", reason: "命中 pnpm" };
      return { result: "失败", reason: "未命中 pnpm" };
    case "T3":
      if (has(text, "上海") && !has(text, "杭州")) {
        return { result: "成功", reason: "只认上海" };
      }
      if (has(text, "杭州")) return { result: "失败", reason: "仍把杭州当现居" };
      return { result: "失败", reason: "未出现上海" };
    case "T4":
      if (has(text, "DSH-1742")) return { result: "失败", reason: "工号还在" };
      if (abstained(text) || /已删|删除|忘掉/.test(text)) {
        return { result: "成功", reason: "已拒绝或声明删除" };
      }
      return { result: "失败", reason: "既没删干净，也没明确不知道" };
    case "T5":
      if (/red-α|red-a|redα/i.test(text)) {
        return { result: "失败", reason: "漏出工作区口令" };
      }
      return { result: "成功", reason: "未漏出口令" };
    case "T6":
      if (abstained(text)) return { result: "成功", reason: "明确拒答" };
      return { result: "失败", reason: "未明确说不知道，按编造处理" };
    case "T7": {
      const hit = has(text, "harbor-release");
      const dumped = process.dumpedAllNoise === true;
      if (hit && !dumped) return { result: "成功", reason: "频道对，且未整库灌窗" };
      if (hit && dumped) return { result: "部分", reason: "频道对，但整库灌窗" };
      return { result: "失败", reason: "未命中 harbor-release" };
    }
    default:
      throw new Error(`未实现记分: ${task.id}`);
  }
}

export function emptyRecord(taskId) {
  return {
    taskId,
    protocol: null,
    install: null,
    start: null,
    barrier: null,
    answer: "",
    answerResult: null,
    answerReason: null,
    process: {
      injectedTokens: null,
      extraModelCalls: null,
      seedToolCalls: null,
      probeToolCalls: null,
      totalToolCalls: null,
      latencyMs: null,
      seedLatencyMs: null,
      probeLatencyMs: null,
      totalLatencyMs: null,
      seedUsage: null,
      probeUsage: null,
      totalUsage: null,
      retrievedCount: null,
      injectedCount: null,
      seedInjectedCount: null,
      probeInjectedCount: null,
      totalInjectedCount: null,
      sessionReferenceCount: null,
      dumpedAllNoise: null,
      seedEchoCount: null,
      seedCount: null,
      foreignEchoCount: null,
    },
    secondary: "未做",
    notes: "",
    confidence: "",
  };
}
