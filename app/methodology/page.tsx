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
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="methodology" />
      <main id="main-content" className="content-page reading-page method-overview-page">
        <InnerPageHero
          eyebrow="METHODOLOGY"
          title="评测方法"
          description="让 Agent 完成实际任务，再按事先约定的规则检查结果。每份报告都说明测试条件和适用范围。"
        />

        <div className="method-overview-body">
          <section className="method-overview-section" aria-labelledby="protocols-title">
            <header className="reading-section-heading"><p className="section-label" data-site-label="section" lang="en">EVALUATION SCOPE</p><h2 className="section-title" id="protocols-title" data-site-title="section">我们测什么</h2><p data-site-copy="body">不同能力使用不同任务和评分规则。</p></header>
            <div className="method-capabilities">
              <article>
                <h3 data-site-title="group">跨会话记忆</h3>
                <p data-site-copy="body">换一个会话后，Agent 还能找回之前的信息吗？</p>
                <a href="/methodology/memory">查看评测方法 <span aria-hidden="true">→</span></a>
              </article>
              <article>
                <h3 data-site-title="group">深度研究</h3>
                <p data-site-copy="body">研究插件能否找对答案，并完成有依据的报告？</p>
                <a href="/methodology/deep-research">查看评测方法 <span aria-hidden="true">→</span></a>
              </article>
            </div>
          </section>

          <div className="method-overview-note" id="evaluation-contract">
            <p data-site-copy="body">我们先约定测试条件和评分规则，再运行真实任务。每份报告同时说明结果、异常和适用范围，方便读者检查结论的依据。不同测试条件下的结果不直接比较。</p>
            <a className="method-results-link" href="/results">查看评测结果 <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
