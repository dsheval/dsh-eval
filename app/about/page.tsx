import type { Metadata } from 'next';
import { InnerPageHero } from '../components/InnerPageHero';
import { SiteFooter, SiteHeader } from '../components/SiteChrome';

const title = 'DSH-Eval 是什么 · 产品介绍';
const description = 'DSH-Eval 是面向 DeepSeek Harness（DSH）Agent 与插件的通用测评平台。了解任务、逐题证据、统一标签与原生基线的方法设计，以及独立报告和 Top100 的关系。';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/about' },
  openGraph: { title, description, url: '/about', type: 'website' },
  twitter: { card: 'summary', title, description, images: [] },
};

const steps = [
  ['匹配测试任务', '根据插件的能力描述，选择适合的测试集。'],
  ['执行真实任务', '在约定的模型与环境下，让 Agent 实际完成任务。'],
  ['保留逐题证据', '记录输入输出、执行过程和必要的环境变化，作为判断依据。'],
  ['按能力维度评分', '使用统一标签和评分规则，呈现各项能力的表现。'],
  ['比较插件增益', '与同条件下未安装第三方功能插件的原生 Agent 比较，判断提升或退步。'],
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': 'https://www.dsheval.ai/about#page',
  url: 'https://www.dsheval.ai/about',
  name: title,
  description,
  inLanguage: 'zh-CN',
  isPartOf: { '@id': 'https://www.dsheval.ai/#website' },
  about: {
    '@type': 'SoftwareApplication',
    name: 'DSH-Eval',
    alternateName: ['DSHEval', 'DSHeval'],
    applicationCategory: 'DeveloperApplication',
    description: '面向 DeepSeek Harness（DSH）Agent 与插件的通用测评平台。',
    url: 'https://www.dsheval.ai/',
  },
};

export default function AboutPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="about" />
      <main id="main-content" className="content-page reading-page product-intro-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <InnerPageHero
          eyebrow="ABOUT DSH-EVAL"
          title="万物皆可测"
          description="DSH-Eval 是面向 DeepSeek Harness（DSH）Agent 与插件的通用测评平台。通过任务、证据与基线比较，帮助开发者和选型团队判断能力与插件增益。"
          actions={<a className="method-results-link" href="#method-design">了解方法设计 <span aria-hidden="true">↓</span></a>}
        />

        <div className="product-intro-body">
          <section className="product-intro-section" id="definition" aria-labelledby="definition-title">
            <header className="reading-section-heading">
              <p className="section-label" data-site-label="section" lang="en">PRODUCT & SCOPE</p>
              <h2 className="section-title" id="definition-title" data-site-title="section">让能力判断有依据</h2>
            </header>
            <div className="product-intro-copy">
              <p>Agent 能完成哪些任务？安装插件后有没有提升？升级版本是否出现退步？DSH-Eval 围绕这些问题设计测评，让开发者和选型团队有依据地判断。</p>
              <p>每项结论都需要结合任务、模型与运行环境来理解，方便你判断结果是否适用于自己的场景。</p>
            </div>
          </section>

          <section className="product-intro-section" id="method-design" aria-labelledby="design-title">
            <header className="reading-section-heading">
              <p className="section-label" data-site-label="section" lang="en">METHOD DESIGN</p>
              <h2 className="section-title" id="design-title" data-site-title="section">从任务到可比较的结论</h2>
              <p>产品方法围绕以下五个环节设计。</p>
            </header>
            <ol className="product-method-steps">
              {steps.map(([heading, copy]) => (
                <li key={heading}><h3 data-site-title="group">{heading}</h3><p>{copy}</p></li>
              ))}
            </ol>
          </section>

          <section className="product-intro-section" id="reports-and-top100" aria-labelledby="reports-title">
            <header className="reading-section-heading">
              <p className="section-label" data-site-label="section" lang="en">REPORTS & DISCOVERY</p>
              <h2 className="section-title" id="reports-title" data-site-title="section">从公开材料开始了解</h2>
            </header>
            <div className="product-intro-copy">
              <p>目前可阅读 Memory 与 Deep Research 两份独立报告，查看各自的测试方法、结果和适用范围。</p>
              <div className="method-capabilities">
                <article><h3 data-site-title="group">Memory · 跨会话记忆</h3><p>查看记忆任务结果、测试条件和公开数据。</p><a href="/results/memory/2026-08-28">阅读报告 <span aria-hidden="true">→</span></a><a href="/methodology/memory">评测协议 <span aria-hidden="true">→</span></a></article>
                <article><h3 data-site-title="group">Deep Research · 深度研究</h3><p>查看研究任务结果、基线差异和资源消耗。</p><a href="/results/deep-research/2026-09-04">阅读报告 <span aria-hidden="true">→</span></a><a href="/methodology/deep-research">评测方法 <span aria-hidden="true">→</span></a></article>
              </div>
              <p><a href="/top100/">Top100</a> 是 DSH-Eval 旗下的插件与 Skills 发现栏目。收录与热度不代表通过能力评测。</p>
              <a className="method-results-link" href="/results">查看全部公开结果 <span aria-hidden="true">→</span></a>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
