import type { Metadata } from 'next';
import EvaluationEvidence from '@/app/components/EvaluationEvidence';
import MemoryBenchmark from '@/app/components/MemoryBenchmark';
import { Arrow, SiteFooter, SiteHeader } from '@/app/components/SiteChrome';

const TOP100_URL = 'https://dsheval.ai/';
const RESULT_URL = '/dsheval/results/memory/locomo20-2026-08-28';

export const metadata: Metadata = {
  title: 'DSH Agent 跨会话记忆评测结果 · DSHEval',
  description: '7 个 DSH Agent 在 LoCoMo20 跨会话记忆任务中的双轨评测结果，对比无提示与明确提醒使用记忆时的正确率、延迟和 Token。',
  alternates: { canonical: RESULT_URL },
  openGraph: {
    url: RESULT_URL,
    title: '换一个会话，Agent 还记得吗？· DSHEval',
    description: '同一组题、同一模型和运行环境，只改变是否明确提醒 Agent 使用记忆。',
    type: 'article',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: '换一个会话，Agent 还记得吗？· DSHEval',
    description: '7 个 DSH Agent 的 LoCoMo20 跨会话记忆双轨评测结果。',
    images: [],
  },
};

const resultJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'DSHEval LoCoMo20 跨会话记忆评测结果',
  description: 'DSH Agent 在无提示与明确提醒使用记忆两种模式下的跨会话记忆评测结果。',
  url: `https://dsheval.ai${RESULT_URL}`,
  datePublished: '2026-08-28',
  dateModified: '2026-08-29',
  creator: { '@type': 'Organization', name: 'DSHEval', url: 'https://dsheval.ai/dsheval' },
  distribution: {
    '@type': 'DataDownload',
    encodingFormat: 'application/json',
    contentUrl: 'https://dsheval.ai/dsheval/data/memory/locomo20-2026-08-28.json',
  },
};

export default function MemoryResultPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="results" />
      <main id="main-content" className="report-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(resultJsonLd) }} />
        <nav className="report-breadcrumb" aria-label="面包屑">
          <a href="/dsheval/results">评测结果</a><span>/</span><strong>跨会话记忆</strong>
        </nav>
        <MemoryBenchmark />
        <EvaluationEvidence />

        <section className="top100-section top100-compact" id="agent-pool">
          <div className="top100-copy">
            <h2>发现值得安装的 DSH 插件</h2>
            <p>按热度、增长、活跃度与安装证据持续更新；排行不等于能力评测。</p>
            <a className="top100-direct-link" href={TOP100_URL} target="_blank" rel="noreferrer"><span>打开插件市场</span><Arrow /></a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
