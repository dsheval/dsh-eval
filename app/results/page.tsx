import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '../components/SiteChrome';
import memoryBenchmark from '../data/memory/locomo20-2026-08-28.json';

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
      <main id="main-content" className="minimal-results-page">
        <header className="minimal-page-header">
          <p className="section-label">PUBLIC RESULTS</p>
          <h1>评测结果</h1>
          <p>查看 DSHEval 已公开的评测。每份报告都会说明评测对象、测试条件、证据、限制和复查状态。</p>
        </header>

        <section className="minimal-results-list" aria-labelledby="published-results-title">
          <header>
            <h2 id="published-results-title">已公开</h2>
            <span>1 项结果</span>
          </header>

          <a className="minimal-result-row" href="/dsheval/results/memory/locomo20-2026-08-28">
            <span className="minimal-result-date">2026-08-28</span>
            <div>
              <small>MEMORY · LOCOMO20</small>
              <h3>跨会话记忆</h3>
              <p>对比无提示和明确提醒使用记忆时的表现。</p>
            </div>
            <dl>
              <div><dt>参与 Agent</dt><dd>{memoryBenchmark.pluginCount}</dd></div>
              <div><dt>任务记录</dt><dd>{memoryBenchmark.totalPluginTaskRecords}</dd></div>
              <div><dt>验证状态</dt><dd>Level 03</dd></div>
            </dl>
            <strong>查看报告 <span aria-hidden="true">→</span></strong>
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
