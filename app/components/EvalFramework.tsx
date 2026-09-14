import styles from './EvalFramework.module.css';

export function EvalFrameworkProduct() {
  return (
    <section className={`product-intro-section ${styles.section}`} id="eval-framework" aria-labelledby="eval-framework-product-title">
      <header className="reading-section-heading">
        <h2 className="section-title" id="eval-framework-product-title" data-site-title="section">当前范围与进展</h2>
      </header>
      <div className={styles.content}>
        <div className={styles.status}>
          <p className={styles.meta}>新框架开发中 · 更新于 2026-09-14</p>
          <p>新框架的真实端到端能力验收尚待完成，受控测试样例不代表真实 Agent 能力成绩。现有公开报告继续按各自公布的方法与测试条件解释。</p>
        </div>
        <dl className={styles.points}>
          <div><dt>评测对象</dt><dd>新框架以指定配置下的完整 DSH Agent 为对象，包含本次模型、插件、工具、权限与环境条件。其他运行时、独立模型或协议的评测需要相应适配与验证。</dd></div>
          <div><dt>运行与查看</dt><dd>新框架处于 MVP 阶段，面向 macOS 任务环境，提供命令行评测及本地／VM 只读报告查看路径。具体安装、版本与开放方式以发布说明为准。</dd></div>
          <div><dt>证据与报告</dt><dd>新框架将运行轨迹、环境变化与交付物组织为统一证据。逐标签 LLM Judge 结合标签标准和题目评分参考给出分数、理由与引用；报告汇总有效维度分数，另列无法判断、评分错误与运行状态。</dd></div>
        </dl>
        <a className={styles.link} href="/methodology/agent-evidence">了解新框架的评测方法 <span aria-hidden="true">→</span></a>
      </div>
    </section>
  );
}
