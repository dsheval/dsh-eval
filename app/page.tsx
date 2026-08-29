import RecommendationDemo from './components/RecommendationDemo';
import MemoryBenchmark from './components/MemoryBenchmark';

const TOP100_URL = 'https://dsheval.ai/';

const answerFields = [
  { label: '推荐什么', copy: '给出首选，也保留可以比较的备选方案。' },
  { label: '为什么适合', copy: '把你的任务、环境、预算和风险偏好写进理由。' },
  { label: '在哪里验证', copy: '绑定插件版本、DSH 版本、操作系统和测试包。' },
  { label: '证据是什么', copy: '区分真实运行、可复现结果与仅供参考的口碑。' },
  { label: '有哪些限制', copy: '主动展示失败样本、未覆盖场景和证据缺口。' },
  { label: '下一步做什么', copy: '查看完整账本、比较备选，或运行一次本地测试。' },
];

const sources = [
  { code: 'A', title: '服务端隔离实测', note: '核心证据', copy: '锁定版本与环境，执行真实任务并记录成功、失败、产物和成本。' },
  { code: 'B', title: '可复现本地结果', note: '交叉验证', copy: '只在用户授权后回传白名单统计，用来验证不同环境中的兼容性。' },
  { code: 'C', title: '匿名反馈与外部信息', note: '仅作辅助', copy: '作者声明、公开口碑和匿名反馈不能单独形成质量结论。' },
];

const rankingExamples = ['ruflo', 'PPT-Design-Skill', 'dsh-desktop'];

function Brand() {
  return (
    <span className="brand-lockup">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <strong>DSH</strong><span>/</span><b>EVAL</b>
    </span>
  );
}

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

const navLinks = [
  { href: '#top', label: '问 Eval' },
  { href: '#memory-benchmark', label: '记忆榜单' },
  { href: '#recommendation-anatomy', label: '评测报告' },
  { href: '#top100', label: 'Top100 热度榜' },
  { href: '#method', label: '评测方法' },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="site-header">
        <a href="#top" className="brand-link" aria-label="DSH Eval 首页"><Brand /></a>

        <nav className="desktop-nav" aria-label="主导航">
          {navLinks.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
        </nav>

        <a className="nav-action" href="#top">查看推荐样例 <Arrow /></a>

        <details className="mobile-nav">
          <summary><span>菜单</span><i aria-hidden="true" /></summary>
          <nav aria-label="移动端导航">
            {navLinks.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
          </nav>
        </details>
      </header>

      <main id="main-content">
        <RecommendationDemo />

        <section className="intent-strip" aria-label="选择你的目标">
          <a href="#top"><span>我有一个任务</span><b>查看推荐样例</b><Arrow /></a>
          <a href="#top100"><span>我想发现插件</span><b>浏览 Top100</b><Arrow /></a>
          <a href="#recommendation-anatomy"><span>我想验证插件</span><b>了解评测报告</b><Arrow /></a>
        </section>

        <MemoryBenchmark />

        <section className="anatomy-section" id="recommendation-anatomy">
          <div className="section-heading compact-heading">
            <p className="section-label">推荐报告 / WHAT A VERDICT OWES YOU</p>
            <h2>一条可信推荐，<br />必须回答 6 件事。</h2>
            <p>不是把模型的回答排版得更漂亮，而是让每个结论都能被检查、被质疑，也允许在证据不足时暂停推荐。</p>
          </div>

          <div className="anatomy-grid">
            <ol className="answer-checklist">
              {answerFields.map((item, index) => (
                <li key={item.label}>
                  <span>0{index + 1}</span>
                  <div><h3>{item.label}</h3><p>{item.copy}</p></div>
                </li>
              ))}
            </ol>

            <div className="trust-column">
              <article className="source-ledger">
                <header><span>证据来源</span><small>强度从 A 到 C 递减</small></header>
                {sources.map((source) => (
                  <div className="source-row" key={source.code}>
                    <span>{source.code}</span>
                    <div><h3>{source.title}</h3><p>{source.copy}</p></div>
                    <small>{source.note}</small>
                  </div>
                ))}
              </article>

              <article className="hold-card">
                <span>TRUST SIGNAL / 04</span>
                <h3>当前证据不足，<br />暂不推荐。</h3>
                <p>只有作者说明、没有当前版本实测时，DSH Eval 会明确说“不知道”，并列出还缺哪些证据。</p>
                <a href="#method">查看如何补齐证据 <span aria-hidden="true">→</span></a>
              </article>
            </div>
          </div>
        </section>

        <section className="method-section" id="method">
          <div className="method-intro">
            <p className="section-label light-label">评测方法 / HOW IT WORKS</p>
            <h2>模型负责理解，<br />真实运行决定结论。</h2>
            <p>评测从你的约束开始，也在证据的边界处结束。模型不能把 README、宣传或猜测写成实测事实。</p>
          </div>

          <ol className="method-steps">
            <li><span>01</span><div><small>DEFINE</small><h3>把“适合”变成检查条件</h3><p>任务、系统、预算、时延和风险偏好，都会进入推荐边界。</p></div></li>
            <li><span>02</span><div><small>RUN</small><h3>让候选完成真实任务</h3><p>锁定版本与环境，记录安装、运行、产物、失败和成本。</p></div></li>
            <li><span>03</span><div><small>DECIDE</small><h3>把证据翻译成可行动的选择</h3><p>输出首选、备选、限制与下一步；证据不够就暂不推荐。</p></div></li>
          </ol>
        </section>

        <section className="top100-section" id="top100">
          <div className="top100-copy">
            <p className="section-label light-label">DSH-TOP100 / DISCOVERY LAYER</p>
            <h2>大家关注的，<br />不一定适合你。</h2>
            <p>Top100 用公开信号发现候选；DSH Eval 用真实任务判断适配。热度只负责发现，不进入质量结论。</p>
            <div className="top100-equation"><span>TOP100</span><i aria-hidden="true">→</i><span>EVAL</span><i aria-hidden="true">→</i><span>YOUR CHOICE</span></div>
            <a className="button button-outline-light" href={TOP100_URL} target="_blank" rel="noreferrer">查看当前线上 Top100 <Arrow /></a>
          </div>

          <div className="ranking-card">
            <header><span>Top100 界面示例</span><small>演示数据 · 正式版接入实时榜单</small></header>
            {rankingExamples.map((name, index) => (
              <a href={TOP100_URL} target="_blank" rel="noreferrer" className="rank-row" key={name}>
                <span>0{index + 1}</span>
                <div><b>{name}</b><small>公开热度信号</small></div>
                <em>候选</em>
                <Arrow />
              </a>
            ))}
            <footer><span>热度 ≠ 质量结论</span><span>从候选继续评测 →</span></footer>
          </div>
        </section>

        <section className="principles-section" id="principles">
          <div className="principles-heading">
            <p className="section-label">可信边界 / BUILT FOR TRUST</p>
            <h2>可信，不靠一句口号。</h2>
          </div>
          <div className="principle-list">
            <article><span>模型不是证据</span><p>它只能分析已经进入证据账本的结果。</p></article>
            <article><span>结论绑定上下文</span><p>版本、环境、测试包、日期和失败样本必须同时存在。</p></article>
            <article><span>数据默认留在本地</span><p>最小化、先脱敏、逐项授权后才可选择性回传。</p></article>
          </div>
          <p className="independence-note">DSH Eval 是面向 DeepSeek Harness 生态的独立评测项目。本概念页不代表 DeepSeek 官方背书或正式产品能力。</p>
        </section>

        <section className="final-section">
          <div>
            <p className="section-label light-label">DSH EVALUATION STANDARD</p>
            <h2>一切皆插件，<br />万物皆可测。</h2>
          </div>
          <div className="final-copy">
            <p>先看一份推荐如何被证据支撑，再决定它是否值得进入你的工作流。</p>
            <a className="button button-primary" href="#top">查看推荐样例 <span aria-hidden="true">→</span></a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a href="#top" aria-label="返回顶部"><Brand /></a>
        <p>面向 DSH 插件生态的独立评测与推荐项目</p>
        <div><a href="#recommendation-anatomy">评测报告</a><a href="#top100">Top100</a><a href="#method">评测方法</a></div>
        <span>© 2026 DSH Eval</span>
      </footer>
    </>
  );
}
