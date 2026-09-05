import type { Metadata } from 'next';
import { InnerPageHero } from '@/app/components/InnerPageHero';
import { SiteFooter, SiteHeader } from '@/app/components/SiteChrome';

const METHOD_URL = '/methodology/memory';
const RESULT_URL = '/results/memory/locomo20-2026-08-28';

export const metadata: Metadata = {
  title: '跨会话记忆评测协议 · DSH-Eval',
  description: '了解 DSH-Eval 如何清理环境、执行双轨跨会话记忆任务、确定性判分、记录失败并发布可复查证据。',
  alternates: { canonical: METHOD_URL },
  openGraph: {
    url: METHOD_URL,
    title: '跨会话记忆评测协议 · DSH-Eval',
    description: '无提示与明确提醒使用记忆两条测试轨道，共用题目、模型、环境和评分规则。',
    type: 'article',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: '跨会话记忆评测协议 · DSH-Eval',
    description: '了解环境清理、双轨任务、确定性判分、失败记录与证据发布方法。',
    images: [],
  },
};

const methodSteps = [
  ['01', '清理环境', '清空测试工作区，移除上一题留下的文件、会话和临时状态。'],
  ['02', '会话 A：提供信息', '向 Agent 提供原始对话。两条轨道仅在是否提醒使用记忆上不同。'],
  ['03', '关闭并重启 DSH', '正常关闭，等待记忆写入和进程退出，再重新启动。不是在原进程中直接新建会话。'],
  ['04', '会话 B：提出问题', '在新会话中提出同一道题，不提供答案、工具名或历史会话 ID。'],
  ['05', '确定性判分', '答案命中标准答案，或覆盖全部必需信息才算通过；不使用 LLM 评分。'],
  ['06', '记录与复查', '保存结果、延迟、Token、失败与限制，并输出脱敏数据快照。'],
];

const tracks = [
  {
    id: 'passive',
    label: 'PASSIVE',
    title: '无提示',
    purpose: '观察默认的记忆表现',
    seed: '提供原始对话，不要求保存记忆。',
    probe: '直接提问，不要求检索记忆。',
  },
  {
    id: 'guided',
    label: 'GUIDED',
    title: '有提示',
    purpose: '观察明确提醒后的记忆表现',
    seed: '提供相同对话，增加通用的持久记忆提示。',
    probe: '提出相同问题，提醒先检索持久记忆。',
  },
];

const scoringMetrics = [
  ['正确率', '通过题数 ÷ 有效题数'],
  ['平均耗时', '每题有效执行时间，超时按上限计'],
  ['输入 Token', '每题平均输入量，包含缓存读取'],
  ['评测故障', '框架或处理器失败，单独记录，不混入能力分'],
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
      <main id="main-content" className="content-page memory-protocol-page">
        <InnerPageHero
          eyebrow="METHOD / MEMORY"
          title="跨会话记忆评测协议"
          description="在会话 A 中提供信息，重启后在会话 B 中提问。用两条测试轨道，区分 Agent 默认的记忆表现与明确提醒后的表现。"
          breadcrumbs={[
            { label: 'DSH-Eval', href: '/' },
            { label: '评测方法', href: '/methodology' },
            { label: '跨会话记忆' },
          ]}
        />

        <section className="memory-protocol-section" aria-labelledby="variable-title">
          <header className="memory-protocol-heading">
            <p className="section-label">COMPARISON</p>
            <h2 className="section-title" id="variable-title">双轨对照</h2>
            <p>只改变是否提醒使用记忆。<br />两条轨道分别记录、分别呈现。</p>
          </header>
          <div>
            <div className="memory-protocol-tracks">
              {tracks.map((track) => (
                <article className={`memory-protocol-track memory-protocol-track-${track.id}`} key={track.id}>
                  <header>
                    <span>{track.label}</span>
                    <h3>{track.title}</h3>
                    <p>{track.purpose}</p>
                  </header>
                  <dl>
                    <div><dt>会话 A · 提供信息</dt><dd>{track.seed}</dd></div>
                    <div><dt>会话 B · 提出问题</dt><dd>{track.probe}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
            <dl className="memory-protocol-conditions">
              <div><dt>共同条件</dt><dd>同一组题、同一模型、同一运行环境、同一评分规则。</dd></div>
              <div><dt>提示边界</dt><dd>不透露工具名、答案或历史会话 ID。</dd></div>
            </dl>
          </div>
        </section>

        <section className="memory-protocol-section memory-protocol-execution" aria-labelledby="steps-title">
          <header className="memory-protocol-heading">
            <p className="section-label">PROCEDURE</p>
            <h2 className="section-title" id="steps-title">单题执行流程</h2>
            <p>每道题独立完成六个步骤。关键是跨过真实的重启边界，再检查信息能否被找回。</p>
            <p className="memory-protocol-note">在原会话里答对，<br />不等于跨会话记住。</p>
          </header>
          <ol className="memory-protocol-timeline" role="list">
            {methodSteps.map(([number, title, copy]) => (
              <li key={number}>
                <span className="memory-protocol-step-number" aria-hidden="true">{number}</span>
                <div className={number === '03' ? 'memory-protocol-step memory-protocol-restart' : 'memory-protocol-step'}>
                  <div className="memory-protocol-step-heading">
                    <h3>{title}</h3>
                    {number === '03' ? <span>跨会话边界</span> : null}
                  </div>
                  <p>{copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="memory-protocol-section" aria-labelledby="scoring-title">
          <header className="memory-protocol-heading">
            <p className="section-label">SCORING</p>
            <h2 className="section-title" id="scoring-title">判分与统计口径</h2>
            <p>使用预先定义的答案与规则，<br />不使用 LLM 评分。</p>
          </header>
          <div>
            <div className="memory-protocol-pass-rule">
              <h3>怎样才算通过</h3>
              <p>命中标准答案，或完整覆盖题目要求的全部必需信息，才记为通过。</p>
            </div>
            <dl className="memory-protocol-metrics">
              {scoringMetrics.map(([label, description]) => (
                <div key={label}><dt>{label}</dt><dd>{description}</dd></div>
              ))}
            </dl>
          </div>
        </section>

        <section className="memory-protocol-section" aria-labelledby="evidence-title">
          <header className="memory-protocol-heading">
            <p className="section-label">EVIDENCE</p>
            <h2 className="section-title" id="evidence-title">随结果公开的证据</h2>
            <p>报告说明条件、结果与限制。<br />公开数据采用脱敏快照。</p>
          </header>
          <div>
            <dl className="memory-protocol-evidence">
              {evidenceFields.map(([title, copy]) => (
                <div key={title}><dt>{title}</dt><dd>{copy}</dd></div>
              ))}
            </dl>
            <a className="memory-protocol-report" href={RESULT_URL}>
              <span><small>对应公开报告 · LOCOMO20</small><strong>查看跨会话记忆评测结果</strong></span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
