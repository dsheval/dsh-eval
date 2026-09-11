import type { Metadata } from 'next';
import { InnerPageHero } from '../components/InnerPageHero';
import { SiteFooter, SiteHeader } from '../components/SiteChrome';

const METHOD_URL = '/methodology';

export const metadata: Metadata = {
  twitter: { card: 'summary', title: '评测方法 · DSH-Eval', images: [] },
  title: '评测方法 · DSH-Eval',
  description: '了解 DSH-Eval 如何固定比较条件、执行真实任务、区分任务失败与评测故障，并公开可复查的 Agent 与插件评测证据。',
  alternates: { canonical: METHOD_URL },
  openGraph: {
    url: METHOD_URL,
    title: '评测方法 · DSH-Eval',
    description: '从固定条件、真实执行到判分和证据公开，了解一项 DSH-Eval 结果如何成立。',
    type: 'article',
  },
};

export default function MethodologyPage() {
  return (
    <div className="method-index-layout">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="methodology" />
      <main id="main-content" className="content-page reading-page method-overview-page">
        <InnerPageHero
          eyebrow="METHODOLOGY"
          title="评测方法"
          description="让 Agent 完成实际任务，再按事先约定的规则检查结果。每份报告都说明测试条件和适用范围。"
        />

        <section className="method-index-entries method-capabilities" aria-label="选择评测方法">
          <article>
            <h2 data-site-title="group">深度研究</h2>
            <p data-site-copy="body">研究插件能否找对答案，并完成有依据的报告？</p>
            <a href="/methodology/deep-research">查看评测方法 <span aria-hidden="true">→</span></a>
          </article>
          <article>
            <h2 data-site-title="group">跨会话记忆</h2>
            <p data-site-copy="body">换一个会话后，Agent 还能找回之前的信息吗？</p>
            <a href="/methodology/memory">查看评测方法 <span aria-hidden="true">→</span></a>
          </article>
          <article id="eval-framework">
            <h2 data-site-title="group">新框架：运行轨迹与环境证据</h2>
            <p data-site-copy="body">开发中，尚无评测结果。了解如何将任务过程、环境结果与检查条件关联起来。</p>
            <a href="/methodology/agent-evidence">查看方法说明 <span aria-hidden="true">→</span></a>
          </article>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
