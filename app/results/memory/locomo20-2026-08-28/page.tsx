import type { Metadata } from 'next';
import EvaluationEvidence from '@/app/components/EvaluationEvidence';
import MemoryBenchmark from '@/app/components/MemoryBenchmark';
import { InnerPageHero } from '@/app/components/InnerPageHero';
import benchmark from '@/app/data/memory/locomo20-2026-08-28.json';
import { SiteFooter, SiteHeader } from '@/app/components/SiteChrome';
import { ReportResources, ReportNextLinks } from '@/app/components/ReportElements';

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
      <main id="main-content" className="content-page report-page benchmark-report">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(resultJsonLd) }} />
        <InnerPageHero
          eyebrow="MEMORY EVALUATION · 2026-08-28"
          title={<><span className="title-phrase">换一个会话，</span><wbr /><span className="title-phrase">Agent 还</span><wbr /><span className="title-phrase">记得吗？</span></>}
          description={`同一批 Agent 完成同一组 ${benchmark.sampleSizePerTrack} 道题，对比用户不提醒和明确提醒使用记忆两种情况。`}
          breadcrumbs={[
            { label: 'DSHEval', href: '/dsheval/' },
            { label: '评测结果', href: '/dsheval/results' },
            { label: '跨会话记忆' },
          ]}
        />
        <MemoryBenchmark />
        <ReportResources dataUrl="/dsheval/data/memory/locomo20-2026-08-28.json" codeUrl="https://github.com/dsheval/dsh-eval/tree/main/evals/memory" />
        <EvaluationEvidence />

        <ReportNextLinks />
      </main>
      <SiteFooter />
    </>
  );
}
