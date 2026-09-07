import type { Metadata } from 'next';
import { ProductFaq } from '../components/ProductFaq';
import { InnerPageHero } from '../components/InnerPageHero';
import { SiteFooter, SiteHeader } from '../components/SiteChrome';

const title = 'DSH-Eval 是什么 · 产品介绍';
const description = 'DSH-Eval 是面向 DeepSeek Harness（DSH）Agent 与插件的通用测评平台。了解任务、逐题证据、统一标签与原生基线的方法设计，以及评测范围、结果复查等常见问题。';

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
              <ul className="product-key-questions" aria-label="测评回答的三个问题">
                <li>Agent 能完成哪些任务？</li>
                <li>安装插件后有没有提升？</li>
                <li>升级版本是否出现退步？</li>
              </ul>
              <p>DSH-Eval 帮助开发者和选型团队回答这三个问题。每项结论都结合具体任务、模型与运行环境，便于判断是否适用于自己的场景。</p>
            </div>
          </section>

          <section className="product-intro-section" id="method-design" aria-labelledby="design-title">
            <header className="reading-section-heading">
              <p className="section-label" data-site-label="section" lang="en">METHOD DESIGN</p>
              <h2 className="section-title" id="design-title" data-site-title="section">从任务到可比较的结论</h2>
              <p>为回答这些问题，测评方法围绕以下五个环节设计。</p>
            </header>
            <ol className="product-method-steps">
              {steps.map(([heading, copy]) => (
                <li key={heading}><h3 data-site-title="group">{heading}</h3><p>{copy}</p></li>
              ))}
            </ol>
          </section>

          <ProductFaq />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
