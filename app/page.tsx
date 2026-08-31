import EvaluationDemo from './components/EvaluationDemo';
import MemoryBenchmark from './components/MemoryBenchmark';

const TOP100_URL = 'https://dsheval.ai/';

const evaluationSteps = [
  ['01', '固定测试条件', 'Agent 版本、运行环境、题集和评分规则，都在测试开始前锁定。'],
  ['02', '执行并记录', '让 Agent 完成真实任务，保留操作过程、状态变化和最终输出。'],
  ['03', '复查并评分', '按照预先公开的规则核对完整记录，再计算测试结果。'],
  ['04', '公开可复查', '发布得分、限制和复查材料；证据不足则明确标记“无法评测”。'],
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
    <span className="brand-lockup" translate="no">
      <strong className="brand-dsh">DSH</strong>
      <span className="brand-slash" aria-hidden="true">/</span>
      <b className="brand-eval">EVAL</b>
    </span>
  );
}

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

const navLinks = [
  { href: '#memory-benchmark', label: '最新结果', external: false },
  { href: '#result-evidence', label: '评测说明', external: false },
  { href: TOP100_URL, label: 'Top100 候选', external: true },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="site-header">
        <a href="#top" className="brand-link" aria-label="DSHEval 首页"><Brand /></a>

        <nav className="desktop-nav" aria-label="主导航">
          {navLinks.map((link) => (
            <a
              aria-label={link.external ? `${link.label}（新窗口打开）` : undefined}
              href={link.href}
              key={link.href}
              rel={link.external ? 'noreferrer' : undefined}
              target={link.external ? '_blank' : undefined}
            >
              {link.label}{link.external ? <span aria-hidden="true"> ↗</span> : null}
            </a>
          ))}
        </nav>

        <a className="nav-action" href="#memory-benchmark">查看测试结果 <Arrow /></a>

        <details className="mobile-nav">
          <summary><span>菜单</span><i aria-hidden="true" /></summary>
          <nav aria-label="移动端导航">
            {navLinks.map((link) => (
              <a
                aria-label={link.external ? `${link.label}（新窗口打开）` : undefined}
                href={link.href}
                key={link.href}
                rel={link.external ? 'noreferrer' : undefined}
                target={link.external ? '_blank' : undefined}
              >
                {link.label}{link.external ? <span aria-hidden="true"> ↗</span> : null}
              </a>
            ))}
          </nav>
        </details>
      </header>

      <main id="main-content">
        <EvaluationDemo />
        <MemoryBenchmark />

        <section className="proof-section" id="result-evidence">
          <div className="proof-summary">
            <div>
              <p className="section-label">RESULT / VERIFICATION</p>
              <h2>结果可复查，<br />尚待独立复测。</h2>
            </div>
            <dl className="proof-facts">
              <div><dt>证据等级</dt><dd><b>03</b><span>已完成测试</span></dd></div>
              <div><dt>运行状态</dt><dd><b>0</b><span>次评测故障</span></dd></div>
              <div><dt>公开材料</dt><dd><b>2</b><span>结果数据 · 评测代码</span></dd></div>
            </dl>
          </div>

          <div className="proof-details" id="evaluation-pipeline" aria-label="评测方法">
            <details className="proof-detail-group">
              <summary>
                <div><span>METHOD / 01—04</span><b>查看四步评测流程</b></div>
                <small>从固定条件到公开结果</small>
                <i aria-hidden="true">+</i>
              </summary>
              <section className="proof-method proof-detail-content">
                <header><span>METHOD / 01—04</span><h3>一份结果，四次确认。</h3></header>
                <ol>
                  {evaluationSteps.map(([number, title, copy]) => (
                    <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{copy}</p></div></li>
                  ))}
                </ol>
              </section>
            </details>

            <details className="proof-detail-group">
              <summary>
                <div><span>LEVELS / 01—05</span><b>查看五级验证标准</b></div>
                <small>当前结果位于 Level 03</small>
                <i aria-hidden="true">+</i>
              </summary>
              <section className="proof-levels proof-detail-content">
                <header><span>VERIFICATION LEVELS</span><h3>证据走到哪一步，结果就标到哪一级。</h3></header>
                <ol>
                  {trustLevels.map(([number, name, label, copy]) => (
                    <li className={number === '03' ? 'is-current' : undefined} key={name}>
                      <span>{number}</span><div><small>{name}</small><strong>{label}</strong><p>{copy}</p></div>
                    </li>
                  ))}
                </ol>
                <div className="proof-notes">
                  <p><b>证据不足</b> 缺少关键记录时标记“无法评测”，不把它当作零分。</p>
                  <p><b>安全边界</b> 评测通过不等于可以安全使用；权限与高风险操作需单独检查。</p>
                </div>
              </section>
            </details>
          </div>
        </section>

        <section className="top100-section top100-compact" id="agent-pool">
          <div className="top100-copy">
            <div>
              <p className="section-label light-label">CANDIDATES / NEXT</p>
              <h2>想看更多 Agent？</h2>
              <p>Top100 反映关注度，不代表能力排名。入选 Agent 仍需在统一环境和规则下完成测试。</p>
            </div>
            <div className="top100-actions">
              <a className="top100-direct-link" href={TOP100_URL} target="_blank" rel="noreferrer"><span>打开 Top100 候选列表</span><Arrow /></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a href="#top" aria-label="返回顶部"><Brand /></a>
        <p>在统一条件下评测 Agent，结果可复查、可复现</p>
        <div><a href="#memory-benchmark">最新结果</a><a href="#result-evidence">评测说明</a><a href={TOP100_URL} target="_blank" rel="noreferrer">Top100 候选 ↗</a></div>
        <span>© 2026 DSHEval</span>
      </footer>
    </>
  );
}
