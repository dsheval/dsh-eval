import type { Metadata } from 'next';
import EvaluationEvidence from '@/app/components/EvaluationEvidence';
import MemoryBenchmark from '@/app/components/MemoryBenchmark';
import benchmark from '@/app/data/memory/locomo20-2026-08-28.json';
import { SiteFooter, SiteHeader } from '@/app/components/SiteChrome';
import { ReportCover, ReportResources, ReportNextLinks } from '@/app/components/ReportElements';

const RESULT_URL = '/results/memory/locomo20-2026-08-28';

export const metadata: Metadata = {
  title: '跨会话记忆评测报告 · DSH-Eval',
  description: '7 个 DSH Agent 在 LoCoMo20 跨会话记忆任务中的双轨评测结果，对比无提示与明确提醒使用记忆时的正确率、延迟和 Token。',
  alternates: { canonical: RESULT_URL },
  openGraph: {
    url: RESULT_URL,
    title: '跨会话记忆评测报告 · DSH-Eval',
    description: '同一组题、同一模型和运行环境，只改变是否明确提醒 Agent 使用记忆。',
    type: 'article',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: '跨会话记忆评测报告 · DSH-Eval',
    description: '7 个 DSH Agent 的 LoCoMo20 跨会话记忆双轨评测结果。',
    images: [],
  },
};

const resultJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'DSH-Eval LoCoMo20 跨会话记忆评测结果',
  description: 'DSH Agent 在无提示与明确提醒使用记忆两种模式下的跨会话记忆评测结果。',
  url: `https://dsheval.ai${RESULT_URL}`,
  datePublished: '2026-08-28',
  dateModified: '2026-08-29',
  creator: { '@type': 'Organization', name: 'DSH-Eval', url: 'https://dsheval.ai' },
  distribution: {
    '@type': 'DataDownload',
    encodingFormat: 'application/json',
    contentUrl: 'https://dsheval.ai/eval-data/memory/locomo20-2026-08-28.json',
  },
};

export default function MemoryResultPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="results" />
      <main id="main-content" className="content-page reading-page report-page benchmark-report">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(resultJsonLd) }} />
        <ReportCover
          title="跨会话记忆评测报告"
          label="MEMORY EVALUATION"
          date="2026-08-28"
          description="换一个会话，Agent 还记得吗？用同一组题，对比不提醒与明确提醒使用记忆时的表现。"
          finding={`明确提示后，${benchmark.pluginCount} 个 Agent 的正确率均提升`}
          context="正确率提升 10–60 个百分点。结果仅适用于本轮题集与环境，部分 Agent 共享核心实现。"
          facts={[["参评 Agent", `${benchmark.pluginCount} 个`], ["每轨题目", `${benchmark.sampleSizePerTrack} 道`], ["提示方式", "无提示 / 有提示"]]}
          methodUrl="/methodology/memory"
        />
        <MemoryBenchmark />
        <EvaluationEvidence />
        <ReportResources dataFilename="跨会话记忆评测数据-2026-08-28.json" dataUrl="/eval-data/memory/locomo20-2026-08-28.json" codeUrl="https://github.com/dsheval/dsh-eval/tree/main/evals/memory" />

        <ReportNextLinks />
      </main>
      <SiteFooter />
    </>
  );
}
