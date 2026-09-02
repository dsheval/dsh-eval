import benchmark from '../data/memory/locomo20-2026-08-28.json';

export default function EvaluationDemo() {
  const improvedWithGuidance = benchmark.plugins.filter((plugin) => plugin.guided.passed > plugin.passive.passed).length;

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
        <article className="dossier">
          <span className="dossier-notch notch-left" aria-hidden="true" />
          <span className="dossier-notch notch-right" aria-hidden="true" />
          <header className="dossier-head">
            <span>RUN #260829–021</span>
            <span>LEVEL 03 · 已完成测试</span>
          </header>

          <div className="dossier-task">
            <span className="field-label">最新评测 · 跨会话记忆</span>
            <p>换一个会话后，Agent 能否找回之前的信息？</p>
          </div>

          <div className="dossier-verdict">
            <div>
              <span className="field-label">关键结果</span>
              <h2>{improvedWithGuidance} / {benchmark.pluginCount}</h2>
              <p>明确提示后得分上升</p>
            </div>
            <dl className="confidence-block">
              <div><dt>每种模式</dt><dd>{benchmark.sampleSizePerTrack} 题</dd></div>
              <div><dt>任务记录</dt><dd>{benchmark.totalPluginTaskRecords} 条</dd></div>
            </dl>
          </div>

          <p className="dossier-reason">同一组题、同一环境，只改变是否明确提示 Agent 使用记忆。</p>

          <dl className="fact-grid">
            <div><dt>无提示最佳</dt><dd>Causal Memory · 13/20</dd></div>
            <div><dt>有提示最佳</dt><dd>Causal / Graph · 15/20</dd></div>
            <div><dt>评测故障</dt><dd>{benchmark.remainingHandlerFailures} 次</dd></div>
          </dl>
        </article>
      </div>
    </section>
  );
}
