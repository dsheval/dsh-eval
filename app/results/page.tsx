import type { Metadata } from 'next';
import { InnerPageHero } from '../components/InnerPageHero';
import { SiteFooter, SiteHeader } from '../components/SiteChrome';
import memoryBenchmark from '../data/memory/locomo20-2026-08-28.json';
import { researchDate, researchUrl, researchPluginCount, researchLongformPassCount } from '../data/deep-research';

const improvedWithGuidance = memoryBenchmark.plugins.filter(
  (plugin) => plugin.guided.passed > plugin.passive.passed,
).length;

export const metadata: Metadata = {
  twitter: { card: 'summary', title: '评测结果 · DSH-Eval', images: [] },
  title: '评测结果 · DSH-Eval',
  description: '浏览 DSH-Eval 已公开的 Agent 与插件评测结果。每项结果包含版本、环境、方法、证据、限制和复现信息。',
  alternates: { canonical: '/results' },
  openGraph: {
    url: '/results',
    title: '评测结果 · DSH-Eval',
    description: '查看带版本、环境、方法、证据和限制的 Agent 与插件真实任务评测。',
    type: 'website',
  },
};

export default function ResultsPage() {
  return (
    <div className="method-index-layout">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="results" />
      <main id="main-content" className="content-page reading-page results-index-page">
        <InnerPageHero
          eyebrow="PUBLIC RESULTS"
          title="评测结果"
          actions={<p className="results-index-count">已公开 2 项评测</p>}
          description="查看 DSH-Eval 已公开的评测。每份报告都会说明评测对象、测试条件、证据、限制和复查状态。"
        />

        <section className="results-index-list" aria-label="评测报告列表">
          <a className="results-index-report" href={researchUrl}>
            <div className="results-index-meta"><time dateTime={researchDate}>{researchDate}</time><span>已完成测试</span></div>
            <h2 data-site-title="group">深度研究评测报告</h2>
            <p className="results-index-question">研究插件，能交出完整报告吗？</p>
            <p className="results-index-finding"><strong>仅 {researchLongformPassCount} 个插件</strong>通过了其中一道报告题</p>
            <p className="results-index-scope">{researchPluginCount} 个插件 · 2 道报告题</p>
            <span className="result-report-link">查看完整报告 <span aria-hidden="true">→</span></span>
          </a>
          <a className="results-index-report" href="/results/memory/2026-08-28">
            <div className="results-index-meta"><time dateTime="2026-08-28">2026-08-28</time><span>已完成测试</span></div>
            <h2 data-site-title="group">跨会话记忆评测报告</h2>
            <p className="results-index-question">换一个会话后，Agent 能否找回之前的信息？</p>
            <p className="results-index-finding"><strong>{improvedWithGuidance} 个 Agent</strong>明确提示使用记忆后，正确率均提升</p>
            <p className="results-index-scope">{memoryBenchmark.pluginCount} 个 Agent · 每组 {memoryBenchmark.sampleSizePerTrack} 道题</p>
            <span className="result-report-link">查看完整报告 <span aria-hidden="true">→</span></span>
          </a>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}
