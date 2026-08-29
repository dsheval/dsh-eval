export default function EvaluationDemo() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="product-label">DSHEval · Agent Benchmark</p>
        <h1 id="hero-title">测 Agent，<br />看真实表现。</h1>
        <p className="hero-lead">固定 Agent 版本和运行环境，让它完成真实任务。我们记录过程、状态和输出，让每个结果都可以复查和复现。</p>
        <p className="hero-thesis">同一套题、同一环境、同一评分规则。</p>

        <div className="hero-actions">
          <a className="button button-primary" href="#memory-benchmark">查看首批结果 <span aria-hidden="true">→</span></a>
          <a className="text-link" href="#evaluation-pipeline">查看评测方法 <span aria-hidden="true">↗</span></a>
        </div>
      </div>

      <div className="dossier-wrap">
        <article className="dossier">
          <span className="dossier-notch notch-left" aria-hidden="true" />
          <span className="dossier-notch notch-right" aria-hidden="true" />
          <header className="dossier-head">
            <span>RUN #260829–021</span>
            <span>RESULT PUBLISHED</span>
          </header>

          <div className="dossier-task">
            <span className="field-label">本轮测试</span>
            <p>跨会话记忆：换一个会话后，能否找回之前的信息</p>
          </div>

          <div className="evidence-route" aria-label="测试流程">
            <span>检查环境</span><i /><span>执行任务</span><i /><span>记录结果</span><i /><span>统一评分</span>
          </div>

          <div className="dossier-verdict">
            <div>
              <span className="field-label">测试状态</span>
              <h2>已完成</h2>
              <p>结果与运行记录已公开</p>
            </div>
            <dl className="confidence-block">
              <div><dt>任务记录</dt><dd>280 条</dd></div>
              <div><dt>评测故障</dt><dd>0 次</dd></div>
            </dl>
          </div>

          <p className="dossier-reason">7 个 Agent 分别完成无提示和有提示两轮测试，共 280 条任务记录；当前公开结果不含评测程序故障。</p>

          <dl className="fact-grid">
            <div><dt>参评对象</dt><dd>7 个 Agent · 当前公开版本</dd></div>
            <div><dt>测试方案</dt><dd>跨会话记忆 · 每个 Agent 40 题次</dd></div>
            <div><dt>公开记录</dt><dd>操作过程 + 状态 + 输出</dd></div>
          </dl>
        </article>
        <div className="dossier-spine" aria-hidden="true"><span>过程</span><span>状态</span><span>输出</span></div>
      </div>
    </section>
  );
}
