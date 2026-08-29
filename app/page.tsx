import EvaluationDemo from './components/EvaluationDemo';
import MemoryBenchmark from './components/MemoryBenchmark';

const TOP100_URL = 'https://dsheval.ai/';

const evaluationSteps = [
  ['01', 'SETUP', '准备测试', '确认 Agent 版本和运行环境，再选定测试集与评分方式。'],
  ['02', 'RUN', '完成真实任务', '让 Agent 在统一环境中完成任务，并记录操作过程、状态变化和最终输出。'],
  ['03', 'CHECK', '按同一规则评分', '核对运行记录，再按预先公开的标准计算结果。'],
  ['04', 'PUBLISH', '发布结果', '公布得分、限制和复查信息；记录不足的项目标为“无法评测”。'],
];

const trustLevels = [
  ['01', 'REGISTERED', '已收录', '身份、版本和基本信息已经登记。'],
  ['02', 'RUNNABLE', '可运行', '已经在标准 DSH 运行环境中成功调用。'],
  ['03', 'EVALUATED', '已完成测试', '已经按统一方案完成测试，并生成完整记录。'],
  ['04', 'SELF-TESTED', '已提交自测', '开发者已经提交注明测试环境、可复现的自测结果。'],
  ['05', 'VERIFIED', '已独立复测', '关键结果已经在独立环境中复测确认。'],
];

function Brand() {
  return (
    <span className="brand-lockup">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span className="brand-name"><strong>DSH</strong><b>Eval</b></span>
    </span>
  );
}

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

const navLinks = [
  { href: '#memory-benchmark', label: '测试结果' },
  { href: '#evaluation-pipeline', label: '评测方法' },
  { href: '#agent-pool', label: '参评 Agent' },
  { href: '#trust-levels', label: '验证等级' },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="site-header">
        <a href="#top" className="brand-link" aria-label="DSHEval 首页"><Brand /></a>

        <nav className="desktop-nav" aria-label="主导航">
          {navLinks.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
        </nav>

        <a className="nav-action" href="#memory-benchmark">查看测试结果 <Arrow /></a>

        <details className="mobile-nav">
          <summary><span>菜单</span><i aria-hidden="true" /></summary>
          <nav aria-label="移动端导航">
            {navLinks.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
          </nav>
        </details>
      </header>

      <main id="main-content">
        <EvaluationDemo />
        <MemoryBenchmark />

        <section className="method-section" id="evaluation-pipeline">
          <div className="method-intro">
            <p className="section-label light-label">EVALUATION METHOD / V1</p>
            <h2>评测怎么做？</h2>
            <p>DSHEval 固定测试条件，让每个 Agent 按同一方案完成真实任务，再根据运行记录评分。</p>
          </div>

          <ol className="method-steps evaluation-steps">
            {evaluationSteps.map(([number, code, title, copy]) => (
              <li key={number}><span>{number}</span><div><small>{code}</small><h3>{title}</h3><p>{copy}</p></div></li>
            ))}
          </ol>
        </section>

        <section className="top100-section top100-compact" id="agent-pool">
          <div className="top100-copy">
            <div>
              <p className="section-label light-label">TOP100 / CANDIDATES</p>
              <h2>Top100 提供候选，<br />测试决定结果。</h2>
              <p>Top100 反映关注度，不代表能力排名。入选 Agent 仍需在统一环境和规则下完成测试。</p>
            </div>
            <div className="top100-actions">
              <div className="top100-equation"><span>TOP100</span><i aria-hidden="true">→</i><span>参评列表</span><i aria-hidden="true">→</i><span>统一评测</span></div>
              <a className="button button-outline-light" href={TOP100_URL} target="_blank" rel="noreferrer">查看 Top100 <Arrow /></a>
            </div>
          </div>
        </section>

        <section className="principles-section" id="trust-levels">
          <div className="principles-heading">
            <p className="section-label">VERIFICATION LEVELS</p>
            <h2>结果确认到哪一步？</h2>
          </div>

          <div className="trust-level-list">
            {trustLevels.map(([number, name, label, copy]) => (
              <article key={name}>
                <span>{number}</span>
                <div><small>{name}</small><h3>{label}</h3><p>{copy}</p></div>
              </article>
            ))}
          </div>

          <div className="trust-note-grid compact-trust-notes">
            <article><span>证据不足</span><h3>缺少关键记录时，不给出结论。</h3><p>“无法评测”不是零分，而是现有资料不足以支持判断。</p></article>
            <article><span>安全检查</span><h3>评测通过，不等于可以安全使用。</h3><p>权限、数据访问和高风险操作需要单独检查。</p></article>
          </div>

          <p className="independence-note">当前 V1 提供统一评测、结果记录和初版结果库；更多公开结果、MCP 接口和推荐功能将在后续开放。</p>
        </section>
      </main>

      <footer className="site-footer">
        <a href="#top" aria-label="返回顶部"><Brand /></a>
        <p>在统一条件下评测 Agent，结果可复查、可复现</p>
        <div><a href="#memory-benchmark">测试结果</a><a href="#evaluation-pipeline">评测方法</a><a href="#trust-levels">验证等级</a></div>
        <span>© 2026 DSHEval</span>
      </footer>
    </>
  );
}
