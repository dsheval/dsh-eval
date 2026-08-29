'use client';

import { useState } from 'react';
import benchmark from '../data/memory/locomo20-2026-08-28.json';

type Protocol = 'passive' | 'guided';
type Metric = 'accuracy' | 'latency' | 'tokens';
type Plugin = (typeof benchmark.plugins)[number];
type TrackResult = Plugin[Protocol];

const metricConfig: Record<Metric, {
  label: string;
  note: string;
  lowerIsBetter: boolean;
  max: number;
  value: (track: TrackResult) => number;
  format: (value: number) => string;
}> = {
  accuracy: {
    label: '严格正确率',
    note: '命中标准答案或全部 must-include 记号；越高越好。',
    lowerIsBetter: false,
    max: 100,
    value: (track) => track.accuracy * 100,
    format: (value) => `${Math.round(value)}%`,
  },
  latency: {
    label: '有效延迟',
    note: '每题平均有效总延迟，超时按 60 秒计入；越低越好。',
    lowerIsBetter: true,
    max: 50,
    value: (track) => track.meanEffectiveLatencyMs / 1000,
    format: (value) => `${value.toFixed(1)}s`,
  },
  tokens: {
    label: '提示 Token',
    note: '题均 input + cache-read token；越低越好。',
    lowerIsBetter: true,
    max: 65000,
    value: (track) => track.meanPromptTokens,
    format: (value) => Math.round(value).toLocaleString('zh-CN'),
  },
};

const pipeline = [
  ['01', '清理环境', '清空甲/乙工作区，移除上一题插件库与 DSH 会话。'],
  ['02', '会话 A 埋点', '发送 LoCoMo 原始证据；两轨只在附加指令上不同。'],
  ['03', '生命周期屏障', '优雅关闭 DSH，等待持久化完成后冷启动。'],
  ['04', '会话 B 追问', '清除埋点工作区文件，在全新会话提出同一道问题。'],
  ['05', '确定性评分', '只按答案与记号判分，不使用 LLM 裁判。'],
];

const formatSeconds = (milliseconds: number) => `${(milliseconds / 1000).toFixed(1)}s`;
const formatInt = (value: number) => Math.round(value).toLocaleString('zh-CN');
const metricBarWidth = (value: number, config: (typeof metricConfig)[Metric]) => {
  const ratio = Math.min(1, Math.max(0, value / config.max));
  return (config.lowerIsBetter ? 1 - ratio : ratio) * 100;
};

function TrackCard({ protocol }: { protocol: Protocol }) {
  const isPassive = protocol === 'passive';
  const definition = benchmark.protocols[protocol];
  return (
    <article className={`memory-protocol-card ${protocol}`}>
      <header>
        <div><span>{isPassive ? '01' : '02'}</span><strong>{protocol}</strong></div>
        <small>{definition.label}</small>
      </header>
      <h3>{isPassive ? '不提醒记忆，看插件会不会自己工作' : '明确记忆意图，看正确触发后的能力'}</h3>
      <p>{definition.meaning}</p>
      <dl>
        <div>
          <dt>会话 A · 埋点附加</dt>
          <dd>{definition.seedInstruction ?? '无——完全使用原始 LoCoMo 对话。'}</dd>
        </div>
        <div>
          <dt>会话 B · 追问附加</dt>
          <dd>{definition.probeInstruction ?? '无——完全使用原始测试问题。'}</dd>
        </div>
      </dl>
      <div className="track-answer">
        <span>这条轨道回答</span>
        <strong>{isPassive ? '普通用户不提示时，实际有多好用？' : '用户明确要记忆时，最高能发挥多少？'}</strong>
      </div>
    </article>
  );
}

function Ranking({ protocol }: { protocol: Protocol }) {
  const rows = [...benchmark.plugins].sort((left, right) => left[protocol].rank - right[protocol].rank);
  return (
    <article className={`memory-ranking ${protocol}`}>
      <header><div><span>{protocol}</span><strong>{benchmark.protocols[protocol].label}</strong></div><small>STRICT / 20</small></header>
      <ol>
        {rows.map((row) => {
          const result = row[protocol];
          return (
            <li key={row.id} className={result.rank === 1 ? 'is-first' : undefined}>
              <span>{String(result.rank).padStart(2, '0')}</span>
              <div><strong>{row.name}</strong><small>{formatSeconds(result.meanEffectiveLatencyMs)} 均值 · {formatInt(result.meanPromptTokens)} tok</small></div>
              <b>{result.passed}<i>/20</i></b>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

export default function MemoryBenchmark() {
  const [metric, setMetric] = useState<Metric>('accuracy');
  const config = metricConfig[metric];

  return (
    <section className="memory-benchmark" id="memory-benchmark" aria-labelledby="memory-benchmark-title">
      <div className="memory-benchmark-hero">
        <div>
          <p className="section-label light-label">MEMORY BENCHMARK / LOCO­MO 20</p>
          <h2 id="memory-benchmark-title">同样的问题，<br />两种记忆触发方式。</h2>
        </div>
        <div className="memory-benchmark-intro">
          <p>7 个可运行插件各完成 Passive 与 Guided 两轮相同的 20 道题。基础设施失败已原位补跑，当前公开快照不含 handler failure。</p>
          <div><span><b>{benchmark.pluginCount}</b> 插件</span><span><b>{benchmark.totalPluginTaskRecords}</b> 答题记录</span><span><b>{benchmark.remainingHandlerFailures}</b> Handler failure</span></div>
        </div>
      </div>

      <div className="memory-protocol-grid" aria-label="双轨协议说明">
        <TrackCard protocol="passive" />
        <TrackCard protocol="guided" />
      </div>

      <div className="memory-constant">
        <div><span>CONTROLLED VARIABLE</span><strong>唯一变化：是否添加通用记忆提示</strong></div>
        <p>题目、证据、模型、评分、工作区隔离和真实 DSH 生命周期屏障均保持一致。Guided 不泄露工具名、答案或历史会话 ID。</p>
      </div>

      <div className="memory-pipeline" aria-label="单题执行流程">
        {pipeline.map(([number, title, copy]) => (
          <article key={number}><span>{number}</span><strong>{title}</strong><p>{copy}</p></article>
        ))}
      </div>

      <div className="memory-results-heading">
        <div><p className="section-label light-label">RESULTS / 2026-08-28</p><h3>双轨结果</h3><p>先在同一轨道内看正确率排名，再用延迟、Token 和工具调用解释成本。</p></div>
        <div className="memory-metric-switch" role="group" aria-label="选择对比指标">
          {(Object.keys(metricConfig) as Metric[]).map((name) => (
            <button key={name} type="button" className={metric === name ? 'active' : undefined} aria-pressed={metric === name} onClick={() => setMetric(name)}>
              {metricConfig[name].label}
            </button>
          ))}
        </div>
      </div>

      <div className="memory-chart" aria-label={`${config.label}双轨对比`}>
        <header><span>{config.label}</span><small>{config.note}</small></header>
        {benchmark.plugins.map((row) => {
          const passive = config.value(row.passive);
          const guided = config.value(row.guided);
          return (
            <div className="memory-chart-row" key={row.id}>
              <strong>{row.name}</strong>
              <div className="memory-bars">
                <div><i className="passive" style={{ width: `${metricBarWidth(passive, config)}%` }} /></div>
                <div><i className="guided" style={{ width: `${metricBarWidth(guided, config)}%` }} /></div>
              </div>
              <span>{config.format(passive)} <i>/</i> {config.format(guided)}</span>
            </div>
          );
        })}
        <footer><span><i className="passive" />Passive</span><span><i className="guided" />Guided</span><small>{config.lowerIsBetter ? '数值越低越好' : '数值越高越好'}</small></footer>
      </div>

      <div className="memory-ranking-grid">
        <Ranking protocol="passive" />
        <Ranking protocol="guided" />
      </div>

      <div className="memory-table-wrap">
        <table>
          <thead><tr><th>插件</th><th>Passive</th><th>Guided</th><th>引导增益</th><th>P 延迟</th><th>G 延迟</th><th>P Token</th><th>G Token</th><th>P / G 工具</th></tr></thead>
          <tbody>
            {[...benchmark.plugins].sort((left, right) => left.guided.rank - right.guided.rank).map((row) => (
              <tr key={row.id}>
                <td><strong>{row.name}</strong>{row.implementationOverlap && <small>{row.implementationOverlap}</small>}</td>
                <td>{row.passive.passed}/20</td><td>{row.guided.passed}/20</td>
                <td><b>+{row.guided.passed - row.passive.passed}</b></td>
                <td>{formatSeconds(row.passive.meanEffectiveLatencyMs)}{row.passive.timeoutCount ? <small>{row.passive.timeoutCount} 超时</small> : null}</td>
                <td>{formatSeconds(row.guided.meanEffectiveLatencyMs)}{row.guided.timeoutCount ? <small>{row.guided.timeoutCount} 超时</small> : null}</td>
                <td>{formatInt(row.passive.meanPromptTokens)}</td><td>{formatInt(row.guided.meanPromptTokens)}</td>
                <td>{row.passive.totalToolCalls} / {row.guided.totalToolCalls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="memory-reading-grid">
        <article><span>01</span><strong>两轨都高</strong><p>自动触发与显式调用都可靠，默认体验和能力上限一致。</p></article>
        <article><span>02</span><strong>Guided 高、Passive 低</strong><p>核心能力存在，但默认自动调用策略尚未把能力释放出来。</p></article>
        <article><span>03</span><strong>两轨都低</strong><p>缺口更可能在写入、持久化、检索质量或答案整合。</p></article>
      </div>

      <footer className="memory-evidence-footer">
        <div><span>公开数据快照</span><strong>LoCoMo refined · 20 题 · C0 双轨 0/20</strong><p>Mem9 缺少 API Key，记为 N/A；Mnemon 官方 wrapper 与 dsh-mnemon 共享核心实现。</p></div>
        <div><a href="/dsheval/data/memory/locomo20-2026-08-28.json" download>下载精简 JSON <span aria-hidden="true">↓</span></a><a href="https://github.com/dsheval/dsh-eval/tree/main/evals/memory" target="_blank" rel="noreferrer">查看评测代码 <span aria-hidden="true">↗</span></a></div>
      </footer>
    </section>
  );
}
