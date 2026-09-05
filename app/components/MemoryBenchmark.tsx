'use client';

import { useState } from 'react';
import { ReportHeading } from './ReportElements';
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

const metricBarWidth = (value: number, config: (typeof metricConfig)[Metric]) => {
  const ratio = Math.min(1, Math.max(0, value / config.max));
  return ratio * 100;
};

export default function MemoryBenchmark() {
  const [metric, setMetric] = useState<Metric>('accuracy');
  const config = metricConfig[metric];

  return (
    <section className="memory-benchmark" id="memory-benchmark" aria-labelledby="memory-benchmark-title">
      <ReportHeading id="memory-benchmark-title" title="记忆表现对比" sample={`${benchmark.sampleSizePerTrack} 道题 · 两种提示方式`} />

      <div className="memory-chart report-result-surface" aria-label={`${config.label}两种提示方式对比`}>
        <div className="report-chart-toolbar">
          <div className="memory-metric-switch" role="group" aria-label="选择对比指标">
            {(Object.keys(metricConfig) as Metric[]).map((name) => (
              <button key={name} type="button" className={metric === name ? 'active' : undefined} aria-pressed={metric === name} onClick={() => setMetric(name)}>
                {metricConfig[name].label}
              </button>
            ))}
          </div>
          <p data-site-copy="note">{config.note}</p>
        </div>
        <div className="memory-chart-columns" aria-hidden="true">
          <span>参评 Agent</span><div className="memory-chart-scale"><span>{config.format(0)}</span><span>{config.format(config.max / 2)}</span><span>{config.format(config.max)}</span></div>
          <div className="memory-column-labels"><span>无提示</span><span>有提示</span></div>
        </div>
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
              <span className="memory-values"><span><small>无提示</small><b>{config.format(passive)}</b></span><span><small>有提示</small><b>{config.format(guided)}</b></span></span>
            </div>
          );
        })}
        <footer><span><i className="passive" />无提示</span><span><i className="guided" />有提示</span><small data-site-copy="note">{config.lowerIsBetter ? '数值越低越好' : '数值越高越好'}</small></footer>
        <p className="memory-chart-disclosure" data-site-copy="note"><span>*</span> Mnemon（官方版）来自 Mnemon 官方仓库，与 dsh-mnemon 共享核心实现，不代表完全独立的两种方案。</p>
      </div>
    </section>
  );
}
