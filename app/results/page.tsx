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
          description="看看 Agent 与插件在真实任务中的表现。"
        />

        <section className="results-index-list" aria-label="评测报告列表">
          <a className="results-index-report" href={researchUrl}>
            <div className="results-index-meta"><time dateTime={researchDate}>{researchDate}</time></div>
            <h2 data-site-title="group">深度研究评测报告</h2>
            <p className="results-index-finding">{researchPluginCount} 个插件中，<strong>仅 {researchLongformPassCount} 个</strong>通过了一道报告题</p>
            <span className="result-report-link">查看完整报告 <span aria-hidden="true">→</span></span>
          </a>
          <a className="results-index-report" href="/results/memory/2026-08-28">
            <div className="results-index-meta"><time dateTime="2026-08-28">2026-08-28</time></div>
            <h2 data-site-title="group">跨会话记忆评测报告</h2>
            <p className="results-index-finding"><strong>{improvedWithGuidance} 个 Agent</strong>明确提示使用记忆后，正确率均提升</p>
            <span className="result-report-link">查看完整报告 <span aria-hidden="true">→</span></span>
          </a>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}
