import type { Metadata } from 'next';
import { InnerPageHero } from '@/app/components/InnerPageHero';
import { SiteFooter, SiteHeader } from '@/app/components/SiteChrome';

const METHOD_URL = '/methodology/deep-research';
const RESULT_URL = '/results/deep-research/2026-09-04';
const SOURCE_URL = 'https://github.com/dsheval/dsh-eval/blob/main/evals/deep-research/benchmark.md';

export const metadata: Metadata = {
  title: '深度研究评测方法 · DSH-Eval',
  description: '了解 DSH-Eval 如何比较研究插件与原生能力，检查事实答案、报告交付与引用，并公开评测依据。',
  alternates: { canonical: METHOD_URL },
  openGraph: {
    url: METHOD_URL,
    title: '深度研究评测方法 · DSH-Eval',
    description: '同一组任务，对照原生能力与研究插件，分别检查检索答案与报告质量。',
    type: 'article',
    images: [],
  },
  twitter: { card: 'summary', title: '深度研究评测方法 · DSH-Eval', images: [] },
};

const methodSteps = [
  ['01', '固定比较条件', '锁定 DSH、模型、题面、运行预算和评分配置。先运行原生基线，再分别测试插件。'],
  ['02', '独立运行任务', '每个参评条件使用独立环境和工作区，记录检索、工具调用、输出、耗时与异常。'],
  ['03', '检查答案与报告', '短事实题核对答案与实际检索行为；长报告先检查交付物和链接，再由固定模型评价质量。'],
  ['04', '汇总并公开', '分别统计短事实、长报告与相对基线的增量，公开脱敏记录，同时说明故障、复用记录和适用边界。'],
];

export default function ResearchMethodologyPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="methodology" />
      <main id="main-content" className="content-page reading-page memory-protocol-page research-protocol-page">
        <InnerPageHero
          eyebrow="METHOD / DEEP RESEARCH"
          title="深度研究评测方法"
          description="让研究插件与 DSH 原生能力完成同一组任务。既检查能否找到正确答案，也检查能否交付有依据的完整报告。"
          breadcrumbs={[
            { label: 'DSH-Eval', href: '/' },
            { label: '评测方法', href: '/methodology' },
            { label: '深度研究评测方法' },
          ]}
        />

        <section className="memory-protocol-section" aria-labelledby="comparison-title">
          <header className="memory-protocol-heading">
            <p className="section-label" data-site-label="section" lang="en">COMPARISON</p>
            <h2 className="section-title" id="comparison-title" data-site-title="section">与原生能力对照</h2>
            <p data-site-copy="body">同一轮使用相同任务和运行条件，观察安装插件后带来的变化。</p>
          </header>
          <div>
            <div className="memory-protocol-tracks">
              <article className="memory-protocol-track">
                <header><span data-site-label="section" lang="en">BASELINE</span><h3 data-site-title="group">DSH 原生能力</h3><p data-site-copy="body">不安装额外研究插件，作为比较基线，不参与插件排名。</p></header>
              </article>
              <article className="memory-protocol-track memory-protocol-track-guided">
                <header><span data-site-label="section" lang="en">PLUGIN</span><h3 data-site-title="group">研究插件</h3><p data-site-copy="body">每次只安装一个待测插件。缺少必需凭证等准入问题单独记录，不记质量零分。</p></header>
              </article>
            </div>
          </div>
        </section>

        <section className="memory-protocol-section" aria-labelledby="procedure-title">
          <header className="memory-protocol-heading">
            <p className="section-label" data-site-label="section" lang="en">PROCEDURE</p>
            <h2 className="section-title" id="procedure-title" data-site-title="section">怎样执行</h2>
            <p data-site-copy="body">本轮有两道短事实题、两道长报告题。另有一项诊断复用健康主题报告，不另算独立题目。</p>
          </header>
          <ol className="memory-protocol-timeline" role="list">
            {methodSteps.map(([number, title, copy]) => (
              <li key={number}>
                <span className="memory-protocol-step-number" aria-hidden="true">{number}</span>
                <div className="memory-protocol-step"><h3 data-site-title="minor">{title}</h3><p data-site-copy="body">{copy}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="memory-protocol-section" aria-labelledby="scoring-title">
          <header className="memory-protocol-heading">
            <p className="section-label" data-site-label="section" lang="en">SCORING</p>
            <h2 className="section-title" id="scoring-title" data-site-title="section">怎样判分</h2>
            <p data-site-copy="body">检索答案与报告质量分别统计，不合成为一个加权总分。</p>
          </header>
          <div>
            <div className="memory-protocol-pass-rule"><h3 data-site-title="minor">短事实：答案是否正确</h3><p data-site-copy="body">使用私有标准答案进行精确或可接受答案匹配，并检查是否实际发生多步检索或抓取。</p></div>
            <div className="memory-protocol-pass-rule"><h3 data-site-title="minor">长报告：交付与证据是否充分</h3><p data-site-copy="body">先检查必需交付物、链接可达性和禁止项，再由固定模型、固定提示词的评分器评价事实、完整性、引用忠实度和风险。评分器不获知插件身份。</p><p data-site-copy="body">关键交付物齐全、事实和引用达到门槛且无严重编造，才算通过；可用但仍有缺项或证据不足，记为部分完成。链接能打开，不代表它支持报告中的结论。</p></div>
            <div className="memory-protocol-pass-rule"><h3 data-site-title="minor">异常单独记录</h3><p data-site-copy="body">系统故障、超出能力范围和评分器故障分别标记。评分器无法完成时，保留确定性检查，暂不进入其质量排名，不记质量零分。</p></div>
          </div>
        </section>

        <section className="memory-protocol-section" aria-labelledby="evidence-title">
          <header className="memory-protocol-heading">
            <p className="section-label" data-site-label="section" lang="en">EVIDENCE</p>
            <h2 className="section-title" id="evidence-title" data-site-title="section">公开材料与边界</h2>
            <p data-site-copy="body">这是固定小样本的插件比较，不代表所有研究任务，也不是上游基准的完整官方榜单。</p>
          </header>
          <div>
            <div className="memory-protocol-pass-rule"><p data-site-copy="body">公开数据保留状态、数值、资源用量和来源标记，可复算排名。私有题面、标准答案、报告正文和完整日志未公开，不能仅凭脱敏数据重新核验答案、引用或完整运行过程。</p><p data-site-copy="body">本轮重新运行多跳检索题，其余复用上一批已验证的记录；逐条标明来源。长文质量采用本地模型评分，不标作上游官方分数。</p></div>
            <a className="method-results-link" href={SOURCE_URL} target="_blank" rel="noreferrer">查看原始协议与技术细节 <span aria-hidden="true">↗</span></a>
            <a className="memory-protocol-report" href={RESULT_URL}>
              <span><small>对应公开报告</small><strong>查看深度研究评测结果</strong></span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
