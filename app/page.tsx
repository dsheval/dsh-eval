import ProductHero from './components/ProductHero';
import { SiteFooter, SiteHeader } from './components/SiteChrome';

const TOP100_URL = '/top100/';

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://dsheval.ai/#organization',
      name: 'DSH-Eval',
      url: 'https://dsheval.ai/',
      logo: 'https://dsheval.ai/favicon-a.svg',
      description: '面向 Agent 与插件生态的公开评测平台，在统一环境中执行真实任务，公开测试过程、结果与适用边界。',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://dsheval.ai/#website',
      name: 'DSH-Eval',
      url: 'https://dsheval.ai/',
      inLanguage: 'zh-CN',
      publisher: { '@id': 'https://dsheval.ai/#organization' },
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

        <section className="home-product-relationship" aria-label="Top100 与 DSH-Eval 的关系">
          <p>
            <a href={TOP100_URL}>Top100</a> 是 DSH-Eval 旗下的插件与 Skills 发现栏目。
            <a href="/results">评测结果</a> 公开项目在真实任务中的表现与证据。
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
