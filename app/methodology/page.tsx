import type { Metadata } from 'next';
import { InnerPageHero } from '../components/InnerPageHero';
import { SiteFooter, SiteHeader } from '../components/SiteChrome';

const METHOD_URL = '/dsheval/methodology';

export const metadata: Metadata = {
  title: '评测方法 · DSHEval',
  description: '了解 DSHEval 如何固定比较条件、执行真实任务、区分任务失败与评测故障，并公开可复查的 Agent 与插件评测证据。',
  alternates: { canonical: METHOD_URL },
  openGraph: {
    url: METHOD_URL,
    title: 'DSHEval 评测方法',
    description: '从固定条件、真实执行到判分和证据公开，了解一项 DSHEval 结果如何成立。',
    type: 'article',
  },
};

const comparisonRules = [
  {
    label: '保持相同',
    value: '题目、模型、运行环境、预算与评分规则。',
  },
  {
    label: '允许变化',
    value: '被测 Agent 或插件，以及产品自身必需的公开配置。',
  },
  {
    label: '不能直接比较',
    value: '不同日期、模型、题库或方法版本产生的结果。',
  },
];

const evaluationSteps = [
  {
    number: '01',
    title: '锁定条件',
    copy: '先确定被测对象、版本、题集、模型、环境、预算和判分规则，再开始运行。',
    evidence: '条件记录',
  },
  {
    number: '02',
    title: '执行真实任务',
    copy: 'Agent 在干净环境中完成预定任务。过程、输出、耗时和异常同时被记录。',
    evidence: '任务记录',
  },
  {
    number: '03',
    title: '按预设规则判定',
    copy: '能确定性检查的任务直接按标准答案或必需条件判分；开放任务才使用已冻结并披露的 Judge。',
    evidence: '判定依据',
  },
  {
    number: '04',
    title: '连同边界一起发布',
    copy: '结果不会脱离条件单独出现。故障、人工介入、限制和复测状态与结论一起公开。',
    evidence: '证据报告',
  },
];

const resultStates = [
  ['通过', '评测正常完成，并满足事先定义的全部必需条件。'],
  ['未通过', '评测正常完成，但任务结果没有达到判定标准。'],
  ['无法评测', '对象缺少完成任务所需的入口或能力，无法产生有效判定。'],
  ['评测故障', '网络、账号、工具、环境或脚本阻止了任务完成，不记作能力失败。'],
  ['已补测', '说明补测原因、条件是否保持，以及是否影响原有结论。'],
];

const evidenceFields = [
  ['对象', '名称、版本与测试日期'],
  ['条件', '模型、环境、题集与预算'],
  ['任务', '输入、目标与必需条件'],
  ['过程', '执行记录、输出与异常'],
  ['判定', '评分规则与通过依据'],
  ['边界', '人工介入、限制与复测状态'],
];

export default function MethodologyPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="methodology" />

      <main id="main-content" className="content-page method-contract-page">
        <InnerPageHero
          eyebrow="METHOD / PUBLIC EVALUATION CONTRACT"
          title={<><span className="title-phrase">一次结果，</span><wbr /><span className="title-phrase">怎样才算</span><wbr /><span className="title-phrase">成立。</span></>}
          description="DSHEval 固定版本、任务和判分规则，让 Agent 在真实环境中完成任务；过程、异常、结果与限制一起公开。"
          actions={(
            <nav className="inner-page-hero-actions" aria-label="本页导航">
              <a href="#evaluation-contract">了解比较规则 <span aria-hidden="true">↓</span></a>
              <a href="/dsheval/results">查看评测结果 <span aria-hidden="true">→</span></a>
            </nav>
          )}
        />

        <section className="method-contract-rules" id="evaluation-contract" aria-labelledby="contract-rules-title">
          <header>
            <p className="section-label">COMPARISON</p>
            <h2 className="section-title" id="contract-rules-title">比较成立的前提，<br />是只改变被测条件。</h2>
            <p>“控制变量”不是一句原则。每次对比都必须说明什么保持相同、什么允许变化，以及哪些结果不能放在一起比较。</p>
          </header>
          <dl>
            {comparisonRules.map((rule) => (
              <div key={rule.label}>
                <dt>{rule.label}</dt>
                <dd>{rule.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="method-evidence-chain" aria-labelledby="evidence-chain-title">
          <header>
            <p className="section-label">EVALUATION CHAIN</p>
            <h2 className="section-title" id="evidence-chain-title">一次评测怎样完成。</h2>
            <p>每一步都产生一份可以检查的记录。缺少其中任何一环，结论都会降低置信度或暂不发布。</p>
          </header>
          <ol>
            {evaluationSteps.map((step) => (
              <li key={step.number}>
                <span className="method-step-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </div>
                <strong><span aria-hidden="true">＋</span>{step.evidence}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="method-judgement" aria-labelledby="judgement-title">
          <header>
            <p className="section-label">JUDGEMENT</p>
            <h2 className="section-title" id="judgement-title">任务失败，<br />不等于评测故障。</h2>
            <p>状态必须互相区分。只有在评测正常完成后，才判断 Agent 是否通过任务。</p>
          </header>
          <dl>
            {resultStates.map(([state, definition]) => (
              <div key={state}>
                <dt>{state}</dt>
                <dd>{definition}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="method-evidence-contract" aria-labelledby="evidence-contract-title">
          <header>
            <p className="section-label">EVIDENCE</p>
            <h2 className="section-title" id="evidence-contract-title">结论必须带着证据出现。</h2>
            <p>每份正式结果至少公开下面六类信息。具体截图、轨迹和逐题判定留在测试详情中。</p>
            <a href="/dsheval/results/memory/locomo20-2026-08-28">看一份完整报告 <span aria-hidden="true">→</span></a>
          </header>
          <ul role="list">
            {evidenceFields.map(([field, detail]) => (
              <li key={field}>
                <div><strong>{field}</strong><p>{detail}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="method-protocols" aria-labelledby="protocols-title">
          <div className="method-protocol-index">
            <header>
              <p className="section-label">PROTOCOLS</p>
              <h2 className="section-title" id="protocols-title">具体能力，使用具体协议。</h2>
              <p>总方法只定义共同规则；题目选择、运行方式和专项判分留在各自协议中。</p>
            </header>
            <article>
              <div>
                <span>已公开协议</span>
                <h3>跨会话记忆</h3>
                <p>比较 Agent 在用户不提醒和明确提醒两种情况下，能否在新会话中找回之前的信息。</p>
              </div>
              <a href="/dsheval/methodology/memory">查看评测协议 <span aria-hidden="true">→</span></a>
            </article>
          </div>

          <aside className="method-boundaries" aria-labelledby="boundaries-title">
            <p className="section-label">BOUNDARIES / V1.0</p>
            <h2 id="boundaries-title">结果只在公开条件内成立。</h2>
            <ul>
              <li>闭源产品、云端模型和实时网页只能做条件化复现。</li>
              <li>版本、基底模型、题库或关键配置改变后，需要重新测试。</li>
              <li>新旧方法版本的结果不能默认直接比较。</li>
            </ul>
            <p className="method-updated">方法版本 1.0 · 更新于 2026-09-02</p>
          </aside>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
