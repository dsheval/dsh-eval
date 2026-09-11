import styles from './EvalFramework.module.css';

export function EvalFrameworkProduct() {
  return (
    <section className={`product-intro-section ${styles.section}`} id="eval-framework" aria-labelledby="eval-framework-product-title">
      <header className="reading-section-heading">
        <h2 className="section-title" id="eval-framework-product-title" data-site-title="section">当前范围与进展</h2>
      </header>
      <div className={styles.content}>
        <div className={styles.status}>
          <p className={styles.meta}>新框架开发中 · 更新于 2026-09-11</p>
          <p>尚未全面迁移到新框架，新框架的评测结果尚未产出。现有报告继续按各自公布的方法与测试条件解释。</p>
        </div>
        <dl className={styles.points}>
          <div><dt>评测对象</dt><dd>新框架以指定配置下的完整 DSH Agent 为对象，包含本次模型、插件、工具、权限与环境条件。其他运行时、独立模型或协议的评测需要相应适配与验证。</dd></div>
          <div><dt>运行与查看</dt><dd>新框架处于 MVP 阶段，面向 macOS 任务环境，提供命令行评测及本地／VM 只读报告查看路径。具体安装、版本与开放方式以发布说明为准。</dd></div>
          <div><dt>证据与报告</dt><dd>新框架关联运行轨迹、独立环境观测、检查项与判定，使用逐标签 LLM Judge 和门禁规则汇总结果；报告分别呈现任务判定和运行状态。</dd></div>
        </dl>
        <a className={styles.link} href="/methodology/agent-evidence">了解新框架的评测方法 <span aria-hidden="true">→</span></a>
      </div>
    </section>
  );
}
