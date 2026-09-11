import type { Metadata } from 'next';
import styles from './article.module.css';
import AgentEvidenceArticle from './AgentEvidenceArticle';
import { SiteFooter, SiteHeader } from '../../components/SiteChrome';

const title = 'Agent 任务评测：运行轨迹与环境证据 · DSH-Eval';
const description = '了解开发中的 DSH-Eval 新框架如何关联运行轨迹、环境证据与任务判定。新框架尚无评测结果，现有报告继续按原方法解释。';
const url = '/methodology/agent-evidence';
const canonicalUrl = `https://www.dsheval.ai${url}`;

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  '@id': `${canonicalUrl}#article`,
  url: canonicalUrl,
  headline: '从运行轨迹与环境证据判断 Agent 是否完成任务',
  description,
  inLanguage: 'zh-CN',
  dateModified: '2026-09-11',
  articleSection: '评测方法',
  mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
  author: {
    '@type': 'Organization',
    '@id': 'https://www.dsheval.ai/#organization',
    name: 'DSH-Eval',
    url: 'https://www.dsheval.ai/',
  },
  publisher: { '@id': 'https://www.dsheval.ai/#organization' },
  isPartOf: { '@id': 'https://www.dsheval.ai/#website' },
  about: {
    '@type': 'SoftwareApplication',
    name: 'DSH-Eval',
    alternateName: ['DSHEval', 'DSHeval'],
    applicationCategory: 'DeveloperApplication',
    url: 'https://www.dsheval.ai/',
  },
};


export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: { title, description, url, type: 'article', images: [] },
  twitter: { card: 'summary', title, description, images: [] },
};

export default function AgentEvidenceMethodPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="methodology" />
      <main id="main-content" className={styles.page}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
        <AgentEvidenceArticle />
      </main>
      <SiteFooter />
    </>
  );
}
