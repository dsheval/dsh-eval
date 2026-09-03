import type { Metadata } from 'next';
import { InnerPageHero } from '../components/InnerPageHero';
import { SiteFooter, SiteHeader } from '../components/SiteChrome';
import memoryBenchmark from '../data/memory/locomo20-2026-08-28.json';

const improvedWithGuidance = memoryBenchmark.plugins.filter(
  (plugin) => plugin.guided.passed > plugin.passive.passed,
).length;

export const metadata: Metadata = {
  title: 'DSHEval 评测结果 · Agent 与插件真实任务测试',
  description: '浏览 DSHEval 已公开的 Agent 与插件评测结果。每项结果包含版本、环境、方法、证据、限制和复现信息。',
  alternates: { canonical: '/dsheval/results' },
  openGraph: {
    url: '/dsheval/results',
    title: 'DSHEval 评测结果',
    description: '查看带版本、环境、方法、证据和限制的 Agent 与插件真实任务评测。',
    type: 'website',
  },
};

export default function ResultsPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="results" />
      <main id="main-content" className="content-page minimal-results-page">
        <InnerPageHero
          eyebrow="PUBLIC RESULTS"
          title="评测结果"
          description="查看 DSHEval 已公开的评测。每份报告都会说明评测对象、测试条件、证据、限制和复查状态。"
        />

        <section className="minimal-results-list" aria-labelledby="published-results-title">
          <header>
            <h2 className="section-title" id="published-results-title">已公开</h2>
            <span>1 项结果</span>
          </header>

          <a className="result-report-entry" href="/dsheval/results/memory/locomo20-2026-08-28">
            <div className="result-report-main">
              <div className="result-report-kicker">
                <time dateTime="2026-08-28">2026-08-28</time>
                <span>MEMORY / LOCOMO20</span>
                <span className="result-report-status">LEVEL 03 · 已完成测试</span>
              </div>
              <h3>跨会话记忆</h3>
              <p>换一个会话后，Agent 能否找回之前的信息？</p>
              <span className="result-report-link">查看完整报告 <span aria-hidden="true">→</span></span>
            </div>
            <div className="result-report-finding">
              <span>本轮观察</span>
              <strong>{improvedWithGuidance} / {memoryBenchmark.pluginCount}</strong>
              <p>明确提示后得分上升</p>
              <small>{memoryBenchmark.totalPluginTaskRecords} 条任务记录</small>
            </div>
          </a>
        </section>

        <aside className="minimal-results-note">
          <strong>如何阅读结果</strong>
          <p>结果只在报告说明的版本、环境和任务范围内成立。证据不足时会标记“无法评测”，不会用零分代替。</p>
        </aside>
      </main>
      <SiteFooter />
    </>
  );
}
