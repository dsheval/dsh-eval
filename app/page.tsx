import ProductHero from './components/ProductHero';
import { SiteFooter, SiteHeader } from './components/SiteChrome';

const TOP100_URL = 'https://dsheval.ai/';

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://dsheval.ai/dsheval#organization',
      name: 'DSHEval',
      url: 'https://dsheval.ai/dsheval',
      logo: 'https://dsheval.ai/dsheval/favicon.svg',
      description: '面向 Agent 与插件生态的公开评测平台，在统一环境中执行真实任务，公开测试过程、结果与适用边界。',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://dsheval.ai/dsheval#website',
      name: 'DSHEval',
      url: 'https://dsheval.ai/dsheval',
      inLanguage: 'zh-CN',
      publisher: { '@id': 'https://dsheval.ai/dsheval#organization' },
    },
  ],
};

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="about" />

      <main id="main-content" className="home-page home-product-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <ProductHero />

        <section className="home-product-relationship" aria-label="Top100 与 DSHEval 的关系">
          <p>
            <a href={TOP100_URL} target="_blank" rel="noreferrer">Top100</a> 发现值得关注的项目，
            <a href="/dsheval/results">DSHEval</a> 验证它们的真实表现。
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
