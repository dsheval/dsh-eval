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
    label: '正确率',
    note: '答案必须命中标准答案，或包含全部必需信息；越高越好。',
    lowerIsBetter: false,
    max: 100,
    value: (track) => track.accuracy * 100,
    format: (value) => `${Math.round(value)}%`,
  },
  latency: {
    label: '平均耗时',
    note: '每题平均耗时，超时按 60 秒计算；越低越好。',
    lowerIsBetter: true,
    max: 50,
    value: (track) => track.meanEffectiveLatencyMs / 1000,
    format: (value) => `${value.toFixed(1)}s`,
  },
  tokens: {
    label: '输入 Token',
    note: '每题平均输入 Token（含缓存读取）；越低越好。',
    lowerIsBetter: true,
    max: 65000,
    value: (track) => track.meanPromptTokens,
    format: (value) => Math.round(value).toLocaleString('zh-CN'),
  },
};

const pipeline = [
  ['01', '清理测试环境', '清空两个测试工作区，删除上一题留下的文件和会话。'],
  ['02', '会话 A：提供信息', '发送 LoCoMo 原始对话；两种模式只有附加提示不同。'],
  ['03', '重启环境', '正常关闭 DSH，等待数据写入后重新启动。'],
  ['04', '会话 B：提出问题', '删除会话 A 的工作区文件，在新会话提出同一道题。'],
  ['05', '按标准答案评分', '只看答案和必需信息，不使用 LLM 评分。'],
];

const formatSeconds = (milliseconds: number) => `${(milliseconds / 1000).toFixed(1)}s`;
const formatInt = (value: number) => Math.round(value).toLocaleString('zh-CN');
const metricBarWidth = (value: number, config: (typeof metricConfig)[Metric]) => {
  const ratio = Math.min(1, Math.max(0, value / config.max));
  return ratio * 100;
};

function TrackCard({ protocol }: { protocol: Protocol }) {
  const isPassive = protocol === 'passive';
  const definition = benchmark.protocols[protocol];
  return (
    <article className={`memory-protocol-card ${protocol}`}>
      <header>
        <div><span>{isPassive ? '01' : '02'}</span><strong>{isPassive ? '无提示' : '有提示'}</strong></div>
        <small>{isPassive ? 'PASSIVE' : 'GUIDED'}</small>
      </header>
      <h3>{isPassive ? '不提示记忆：测试默认表现' : '明确要求记忆：测试有提示时的表现'}</h3>
      <p>{isPassive ? '不给出保存或检索提示，观察 Agent 是否会自动记住并在新会话找回信息。' : '只增加通用的记忆操作提示，观察 Agent 在明确要求下的表现。'}</p>
      <dl>
        <div>
          <dt>会话 A · 附加指令</dt>
          <dd>{definition.seedInstruction ?? '无；直接使用原始 LoCoMo 对话。'}</dd>
        </div>
        <div>
          <dt>会话 B · 附加指令</dt>
          <dd>{definition.probeInstruction ?? '无；直接使用原始测试问题。'}</dd>
        </div>
      </dl>
      <div className="track-answer">
        <span>测试问题</span>
        <strong>{isPassive ? '用户不主动提醒时，Agent 能记住多少？' : '用户明确要求记住时，Agent 表现如何？'}</strong>
      </div>
    </article>
  );
}

function Ranking({ protocol }: { protocol: Protocol }) {
  const rows = [...benchmark.plugins].sort((left, right) => left[protocol].rank - right[protocol].rank);
  return (
    <article className={`memory-ranking ${protocol}`}>
      <header><div><span>{protocol}</span><strong>{protocol === 'passive' ? '无提示' : '有提示'}</strong></div><small>得分 / 20</small></header>
      <ol>
        {rows.map((row) => {
          const result = row[protocol];
          return (
            <li key={row.id} className={result.rank === 1 ? 'is-first' : undefined}>
              <span>{String(result.rank).padStart(2, '0')}</span>
              <div><strong>{row.name}</strong><small>平均 {formatSeconds(result.meanEffectiveLatencyMs)} · {formatInt(result.meanPromptTokens)} Token</small></div>
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
          <p className="section-label light-label">MEMORY / CROSS-SESSION</p>
          <h2 id="memory-benchmark-title">同一组题，<br />两种提示方式。</h2>
        </div>
        <div className="memory-benchmark-intro">
          <p>首批公开结果：7 个 Agent 分别在无提示和有提示两种模式下完成相同的 20 道题。因评测程序故障中断的任务已按原条件补测，当前公开结果不含此类失败。</p>
          <div><span><b>{benchmark.pluginCount}</b> 个 Agent</span><span><b>{benchmark.totalPluginTaskRecords}</b> 条答题记录</span><span><b>{benchmark.remainingHandlerFailures}</b> 次评测故障</span></div>
        </div>
      </div>

      <div className="memory-results-heading">
        <div><p className="section-label light-label">RESULTS / 2026-08-28</p><p>切换正确率、平均耗时和输入 Token，对比两种提示方式。</p></div>
        <div className="memory-metric-switch" role="group" aria-label="选择对比指标">
          {(Object.keys(metricConfig) as Metric[]).map((name) => (
            <button key={name} type="button" className={metric === name ? 'active' : undefined} aria-pressed={metric === name} onClick={() => setMetric(name)}>
              {metricConfig[name].label}
            </button>
          ))}
        </div>
      </div>

      <div className="memory-chart" aria-label={`${config.label}两种提示方式对比`}>
        <header><span>{config.label}</span><small>{config.note}</small></header>
        {benchmark.plugins.map((row) => {
          const passive = config.value(row.passive);
          const guided = config.value(row.guided);
          const passivePosition = metricBarWidth(passive, config);
          const guidedPosition = metricBarWidth(guided, config);
          const connectorStart = Math.min(passivePosition, guidedPosition);
          const connectorWidth = Math.abs(guidedPosition - passivePosition);
          return (
            <div className="memory-chart-row" key={row.id}>
              <strong>{row.name}</strong>
              <div className="memory-bars" aria-hidden="true">
                <i className="memory-range-line" style={{ left: `${connectorStart}%`, width: `${connectorWidth}%` }} />
                <i className="memory-point passive" style={{ left: `${passivePosition}%` }} />
                <i className="memory-point guided" style={{ left: `${guidedPosition}%` }} />
              </div>
              <span>{config.format(passive)} <i>/</i> {config.format(guided)}</span>
            </div>
          );
        })}
        <footer><span><i className="passive" />无提示</span><span><i className="guided" />有提示</span><small>{config.lowerIsBetter ? '数值越低越好' : '数值越高越好'}</small></footer>
      </div>

      <details className="memory-details">
        <summary>
          <span>FULL RESULTS &amp; METHOD</span>
          <b>查看完整排名、评测方法和原始数据</b>
          <i aria-hidden="true">+</i>
        </summary>
        <div className="memory-details-content">
          <div className="memory-ranking-grid">
            <Ranking protocol="passive" />
            <Ranking protocol="guided" />
          </div>

          <div className="memory-method-heading">
            <p className="section-label">METHOD / HOW RESULTS ARE CALCULATED</p>
            <h3>评测方法</h3>
            <p>两组测试使用相同问题和环境，仅改变是否明确提示记忆。以下记录用于复查排名。</p>
          </div>

          <div className="memory-protocol-grid" aria-label="两种提示方式说明">
            <TrackCard protocol="passive" />
            <TrackCard protocol="guided" />
          </div>

          <div className="memory-constant">
            <div><span>唯一变量</span><strong>是否明确提示 Agent 使用记忆</strong></div>
            <p>除是否添加通用记忆提示外，题目、提供的信息、模型、评分方式和运行环境均相同。有提示模式不会透露工具名、答案或历史会话 ID。</p>
          </div>

          <div className="memory-pipeline" aria-label="单题执行流程">
            {pipeline.map(([number, title, copy]) => (
              <article key={number}><span>{number}</span><strong>{title}</strong><p>{copy}</p></article>
            ))}
          </div>

          <div className="memory-table-wrap">
            <table>
              <thead><tr><th>Agent</th><th>无提示</th><th>有提示</th><th>提示后提升</th><th>无提示耗时</th><th>有提示耗时</th><th>无提示 Token</th><th>有提示 Token</th><th>工具调用数（无 / 有）</th></tr></thead>
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
            <article><span>01</span><strong>两种模式都高</strong><p>不提示也能稳定记忆，提示后表现同样可靠。</p></article>
            <article><span>02</span><strong>有提示高、无提示低</strong><p>Agent 具备记忆能力，但通常需要用户明确提醒。</p></article>
            <article><span>03</span><strong>两种模式都低</strong><p>问题可能出在信息写入、保存、检索或答案组织。</p></article>
          </div>

          <p className="memory-technical-note">Mem9 未配置 API Key，本次未评测；Mnemon 官方版本与 dsh-mnemon 使用相同核心实现。</p>
        </div>
      </details>

      <footer className="memory-evidence-footer">
        <div><span>TEST RESULTS / 2026-08-28</span><strong>LoCoMo 精选集 · 20 题 · C0 对照组两种模式均为 0/20</strong></div>
        <div><a href="/dsheval/data/memory/locomo20-2026-08-28.json" download>下载结果数据（JSON） <span aria-hidden="true">↓</span></a><a href="https://github.com/dsheval/dsh-eval/tree/main/evals/memory" target="_blank" rel="noreferrer">查看评测代码 <span aria-hidden="true">↗</span></a></div>
      </footer>
    </section>
  );
}
