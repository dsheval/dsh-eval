import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '../components/SiteChrome';

const METHOD_URL = '/dsheval/methodology';

export const metadata: Metadata = {
  title: '评测方法 · DSHEval',
  description: '了解 DSHEval 如何控制变量、执行真实任务、保留完整记录，并发布可复查的 Agent 与插件评测结果。',
  alternates: { canonical: METHOD_URL },
  openGraph: {
    url: METHOD_URL,
    title: 'DSHEval 评测方法',
    description: '控制变量，保留证据，让每个能力结论都可以复查。',
    type: 'article',
  },
};

const methodSteps = [
  ['01', '测试前', '确定对象，固定环境、任务与判断标准。'],
  ['02', '测试中', '执行真实任务，记录完整过程和异常。'],
  ['03', '判分时', '按预设标准判断，评测故障单独记录。'],
  ['04', '发布时', '结论与数据、限制和复测状态一起公开。'],
];

export default function MethodologyPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="methodology" />
      <main id="main-content" className="inner-page method-core-page">
        <header className="method-core-hero">
          <p>评测方法</p>
          <h1>控制变量，<br />保留证据。</h1>
          <p>评测是在相同条件下观察差异，并让别人能够复查差异从何而来。</p>
        </header>

        <section className="method-core-flow" aria-label="DSHEval 评测流程">
          <ol>
            {methodSteps.map(([number, stage, copy]) => (
              <li key={number}>
                <span>{number}</span>
                <h2>{stage}</h2>
                <p>{copy}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="method-core-next">
          <p>查看具体方法</p>
          <nav aria-label="具体评测方法">
            <a href="/dsheval/methodology/memory"><span>跨会话记忆评测协议</span><span aria-hidden="true">→</span></a>
            <a href="/dsheval/results"><span>已公开的评测结果</span><span aria-hidden="true">→</span></a>
          </nav>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
