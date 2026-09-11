import type { Metadata } from 'next';
import { EvalFrameworkProduct } from '../components/EvalFramework';
import { ProductFaq } from '../components/ProductFaq';
import { ProductIdentity } from '../components/ProductIdentity';
import { SiteFooter, SiteHeader } from '../components/SiteChrome';

const title = 'DSH-Eval 是什么 · 产品介绍';
const description = 'DSH-Eval 是面向 DeepSeek Harness（DSH）Agent 与插件的通用测评平台。了解从任务、执行到证据与判定的评测流程、当前支持范围和新框架进展。';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/about' },
  openGraph: { title, description, url: '/about', type: 'website' },
  twitter: { card: 'summary', title, description, images: [] },
};

const steps = [
  ['明确任务', '确定评测对象、运行配置、任务要求与完成条件。'],
  ['执行与观测', '让 Agent 执行任务，按本次方法记录执行过程及相关产物或状态。'],
  ['检查证据', '核对证据是否完整、是否满足对应检查的要求。'],
  ['形成判定', '依据本次评分规则形成结果，保留判定理由、失败原因或证据缺口。'],
  ['阅读报告', '结合检查项、证据、运行状态与适用范围理解结论。'],
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
    sameAs: ['https://github.com/dsheval/dsh-eval'],
  },
};

export default function AboutPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="about" />
      <main id="main-content" className="content-page reading-page product-intro-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <header className="product-intro-cover">
          <h1>DSH-Eval <span>万物皆可测</span></h1>
          <p className="product-intro-lead">DSH-Eval 是面向 DeepSeek Harness（DSH）Agent 与插件的通用测评平台。通过明确任务、记录执行过程与检查证据，帮助开发者和技术团队判断 Agent 的任务表现。</p>
        </header>

        <div className="product-intro-body">
          <section className="product-intro-section" id="definition" aria-labelledby="definition-title">
            <header className="reading-section-heading">
              <h2 className="section-title" id="definition-title" data-site-title="section">让能力判断有依据</h2>
            </header>
            <div className="product-intro-copy">
              <ul className="product-key-questions" aria-label="测评回答的三个问题">
                <li><h3>Agent 能完成<br className="product-question-break" />哪些任务？</h3></li>
                <li><h3>安装插件后<br className="product-question-break" />有没有提升？</h3></li>
                <li><h3>升级版本<br className="product-question-break" />是否出现退步？</h3></li>
              </ul>
              <p>这些是评测希望回答的问题。判断插件增益或版本退步，需要专门组织同条件对照；结论始终对应具体任务、模型与运行环境，不代表默认具备自动版本比较能力。</p>
            </div>
          </section>

          <section className="product-intro-section" id="method-design" aria-labelledby="design-title">
            <header className="reading-section-heading">
              <h2 className="section-title" id="design-title" data-site-title="section">从任务到有依据的判定</h2>
              <p>评测围绕以下五个环节组织，具体任务与评分规则以对应方法说明为准。</p>
            </header>
            <ol className="product-method-steps">
              {steps.map(([heading, copy], index) => (
                <li key={heading}>
                  <span className="product-step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{heading}</h3>
                  <p>{copy}</p>
                </li>
              ))}
            </ol>
          </section>

          <EvalFrameworkProduct />

          <ProductFaq />
          <ProductIdentity />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
