import ProductHero from './components/ProductHero';
import { SiteFooter, SiteHeader } from './components/SiteChrome';

const TOP100_URL = '/top100/';

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.dsheval.ai/#organization',
      name: 'DSH-Eval',
      alternateName: ['DSHEval', 'DSHeval'],
      url: 'https://www.dsheval.ai/',
      logo: 'https://www.dsheval.ai/favicon-a.svg',
      description: '面向 DeepSeek Harness（DSH）Agent 与插件的通用测评平台，围绕任务执行、逐题证据、统一标签评分与原生基线比较设计。',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.dsheval.ai/#website',
      name: 'DSH-Eval',
      url: 'https://www.dsheval.ai/',
      inLanguage: 'zh-CN',
      publisher: { '@id': 'https://www.dsheval.ai/#organization' },
    },
  ],
};

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="home" />

      <main id="main-content" className="home-page home-product-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <ProductHero />

        <section className="home-product-relationship" aria-label="Top100 与 DSH-Eval 的关系">
          <p>
            <a href={TOP100_URL}>Top100</a> 是 DSH-Eval 旗下的插件与 Skills 发现栏目。
            <br />
            <a href="/results">评测结果</a> 公开项目在真实任务中的表现与证据。
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
