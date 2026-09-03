import EvaluationDossier from './EvaluationDossier';

export default function EvaluationDemo() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="product-label">DSHEval · Agent Benchmark</p>
        <h1 id="hero-title">测 Agent，<br />看真实表现。</h1>
        <p className="hero-lead">把 Agent 放进固定环境，完成真实任务。过程、状态和输出一起公开，让结果可以复查，也可以复现。</p>

        <div className="hero-actions">
          <a className="button button-primary" href="#memory-benchmark">查看完整结果 <span aria-hidden="true">→</span></a>
          <a className="text-link" href="#result-evidence">结果如何验证 <span aria-hidden="true">↗</span></a>
        </div>
      </div>

      <div className="dossier-wrap">
        <EvaluationDossier />
      </div>
    </section>
  );
}
