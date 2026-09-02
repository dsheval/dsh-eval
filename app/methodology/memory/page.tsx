import type { Metadata } from 'next';
import { Arrow, SiteFooter, SiteHeader } from '@/app/components/SiteChrome';

const METHOD_URL = '/dsheval/methodology/memory';

export const metadata: Metadata = {
  title: '跨会话记忆评测方法 · DSHEval',
  description: '了解 DSHEval 如何清理环境、执行双轨跨会话记忆任务、确定性判分、记录失败并发布可复查证据。',
  alternates: { canonical: METHOD_URL },
  openGraph: {
    url: METHOD_URL,
    title: '跨会话记忆评测方法 · DSHEval',
    description: '无提示与明确提醒使用记忆两条测试轨道，共用题目、模型、环境和评分规则。',
    type: 'article',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: '跨会话记忆评测方法 · DSHEval',
    description: '了解环境清理、双轨任务、确定性判分、失败记录与证据发布方法。',
    images: [],
  },
};

const methodSteps = [
  ['01', '清理环境', '清空测试工作区，移除上一题留下的文件、会话和临时状态。'],
  ['02', '会话 A：提供信息', '向 Agent 提供原始对话。两条轨道仅在是否提醒使用记忆上不同。'],
  ['03', '正常重启', '关闭 DSH，等待记忆写入，再以新的运行过程重新启动。'],
  ['04', '会话 B：提出问题', '在新会话中提出同一道题，不提供答案、工具名或历史会话 ID。'],
  ['05', '确定性判分', '答案命中标准答案，或覆盖全部必需信息才算通过；不使用 LLM 评分。'],
  ['06', '记录与复查', '保存结果、延迟、Token、失败与限制，并输出脱敏数据快照。'],
];

const evidenceFields = [
  ['对象', 'Agent、插件及版本'],
  ['环境', 'DSH、模型、运行配置'],
  ['任务', '题集、轨道与评分规则'],
  ['过程', '执行记录、错误与重启状态'],
  ['结果', '正确率、延迟、Token'],
  ['边界', '失败、限制与复测状态'],
];

export default function MemoryMethodologyPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="methodology" />
      <main id="main-content" className="inner-page methodology-page">
        <header className="methodology-hero">
          <nav aria-label="面包屑"><a href="/dsheval">DSHEval</a><span>/</span><a href="/dsheval/methodology">评测方法</a><span>/</span><strong>跨会话记忆</strong></nav>
          <div>
            <p className="product-label">METHOD / MEMORY</p>
            <h1>跨会话记忆，<br />如何被测试。</h1>
            <p>这套方法比较 Agent 在“用户不提醒”和“明确提醒使用记忆”两种情况下，能否在新会话中找回之前的信息。</p>
          </div>
        </header>

        <section className="method-variable" aria-labelledby="variable-title">
          <div><p className="section-label">ONE VARIABLE</p><h2 id="variable-title">只改变一件事：是否提醒。</h2></div>
          <div className="method-track-grid">
            <article><span>TRACK A</span><h3>无提示</h3><p>直接提供原始对话和问题，不要求保存或检索记忆，用来观察默认表现。</p></article>
            <article><span>TRACK B</span><h3>有提示</h3><p>只增加通用记忆提示，不透露工具名、答案或历史会话 ID。</p></article>
          </div>
          <p className="method-constant">两条轨道使用同一组题、同一模型、同一运行环境和同一评分规则。</p>
        </section>

        <section className="method-steps" aria-labelledby="steps-title">
          <header><p className="section-label">PROTOCOL</p><h2 id="steps-title">每一道题都经过六个步骤。</h2></header>
          <ol>
            {methodSteps.map(([number, title, copy]) => (
              <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></li>
            ))}
          </ol>
        </section>

        <section className="method-scoring" aria-labelledby="scoring-title">
          <div>
            <p className="section-label light-label">SCORING</p>
            <h2 id="scoring-title">判分不交给另一个模型猜。</h2>
            <p>题目预先定义标准答案或必需信息。只有命中标准答案，或者完整覆盖全部必需信息，才记为通过。</p>
          </div>
          <dl>
            <div><dt>正确率</dt><dd>通过题数 ÷ 有效题数</dd></div>
            <div><dt>平均耗时</dt><dd>每题有效执行时间，超时按上限计</dd></div>
            <div><dt>输入 Token</dt><dd>每题平均输入量，包含缓存读取</dd></div>
            <div><dt>评测故障</dt><dd>框架或处理器失败，单独记录不混入能力分</dd></div>
          </dl>
        </section>

        <section className="method-evidence" aria-labelledby="evidence-title">
          <header><p className="section-label">EVIDENCE CONTRACT</p><h2 id="evidence-title">正式结果必须带着这些信息一起出现。</h2></header>
          <div>
            {evidenceFields.map(([title, copy]) => (
              <article key={title}><h3>{title}</h3><p>{copy}</p></article>
            ))}
          </div>
        </section>

        <section className="method-cta">
          <div><p className="section-label">SEE THE RESULT</p><h2>方法公开，结果才能复查。</h2></div>
          <a href="/dsheval/results/memory/locomo20-2026-08-28">查看跨会话记忆结果 <Arrow /></a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
