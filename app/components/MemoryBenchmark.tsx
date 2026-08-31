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

const metricBarWidth = (value: number, config: (typeof metricConfig)[Metric]) => {
  const ratio = Math.min(1, Math.max(0, value / config.max));
  return ratio * 100;
};

export default function MemoryBenchmark() {
  const [metric, setMetric] = useState<Metric>('accuracy');
  const config = metricConfig[metric];

  return (
    <section className="memory-benchmark" id="memory-benchmark" aria-labelledby="memory-benchmark-title">
      <div className="memory-benchmark-hero">
        <div>
          <p className="section-label light-label">MEMORY BENCHMARK / 2026-08-28</p>
          <h2 id="memory-benchmark-title">换一个会话，Agent 还记得吗？</h2>
          <p className="memory-benchmark-deck">同一批 Agent 完成同一组 {benchmark.sampleSizePerTrack} 道题，对比用户不提醒和明确提醒使用记忆两种情况。</p>
        </div>
      </div>

      <div className="memory-results-heading">
        <p className="memory-result-readout"><span>结论</span><strong>{benchmark.pluginCount}/{benchmark.pluginCount} 个 Agent 提示后得分上升；无提示表现差距明显。</strong></p>
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
              <strong>{row.name}{row.implementationOverlap ? <sup aria-label="与 dsh-mnemon 共享核心实现">*</sup> : null}</strong>
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
        <p className="memory-chart-disclosure"><span>*</span> Mnemon（官方版）来自 Mnemon 官方仓库，与 dsh-mnemon 共享核心实现，不代表完全独立的两种方案。</p>
      </div>

      <footer className="memory-source-actions">
        <p><span>原始记录</span><strong>数据与评测代码已公开</strong></p>
        <div><a href="/dsheval/data/memory/locomo20-2026-08-28.json" download>下载结果数据（JSON） <span aria-hidden="true">↓</span></a><a href="https://github.com/dsheval/dsh-eval/tree/main/evals/memory" target="_blank" rel="noreferrer">查看评测代码 <span aria-hidden="true">↗</span></a></div>
      </footer>

      <details className="memory-details">
        <summary>
          <span>PROTOCOL / CURRENT TEST</span>
          <b>查看本次测试如何执行</b>
          <i aria-hidden="true">+</i>
        </summary>
        <div className="memory-details-content memory-details-compact">
          <header className="memory-compact-heading">
            <p className="section-label">PROTOCOL / CURRENT BENCHMARK</p>
            <h3>唯一变量：是否提醒 Agent 使用记忆。</h3>
            <p>两组测试使用同一组 {benchmark.sampleSizePerTrack} 道题、同一模型和运行环境；提示不会透露工具名、答案或历史会话 ID。</p>
          </header>

          <div className="memory-track-summary" aria-label="两种提示方式说明">
            <article><span>01 / 无提示</span><strong>观察默认表现</strong><p>直接提供原始对话和问题，不要求保存或检索记忆。</p></article>
            <article><span>02 / 有提示</span><strong>观察提醒后的表现</strong><p>只增加通用记忆提示，不改变题目、答案和评分方式。</p></article>
          </div>

          <div className="memory-pipeline" aria-label="单题执行流程">
            {pipeline.map(([number, title, copy]) => (
              <article key={number}><span>{number}</span><strong>{title}</strong><p>{copy}</p></article>
            ))}
          </div>

          <footer className="memory-detail-source"><p>完整逐项成绩、耗时和 Token 数据保存在原始 JSON 中。</p><a href="/dsheval/data/memory/locomo20-2026-08-28.json" download>下载完整数据 <span aria-hidden="true">↓</span></a></footer>
        </div>
      </details>
    </section>
  );
}
