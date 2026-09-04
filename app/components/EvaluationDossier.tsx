import benchmark from '../data/memory/locomo20-2026-08-28.json';

type EvaluationDossierProps = {
  className?: string;
  compact?: boolean;
  reportHref?: string;
};

export default function EvaluationDossier({ className, compact = false, reportHref }: EvaluationDossierProps) {
  const improvedWithGuidance = benchmark.plugins.filter(
    (plugin) => plugin.guided.passed > plugin.passive.passed,
  ).length;
  const classes = ['dossier', compact ? 'dossier-compact' : '', className].filter(Boolean).join(' ');

  return (
    <article className={classes}>
      <span className="dossier-notch notch-left" aria-hidden="true" />
      <span className="dossier-notch notch-right" aria-hidden="true" />
      <header className="dossier-head">
        <span>发布于 {benchmark.evaluationDay}</span>
        <span>已完成测试</span>
      </header>

      <div className="dossier-task">
        <span className="field-label">跨会话记忆</span>
        <p>换一个会话，Agent 还记得吗？</p>
      </div>

      <div className="dossier-verdict">
        <div>
          <span className="field-label">本轮观察</span>
          <h2>{improvedWithGuidance} 个 Agent</h2>
          <p>明确提示使用记忆后，正确率均提升</p>
        </div>
        <dl className="confidence-block">
          <div><dt>参评 Agent</dt><dd>{benchmark.pluginCount} 个</dd></div>
          <div><dt>每组题目</dt><dd>{benchmark.sampleSizePerTrack} 道</dd></div>
        </dl>
      </div>

      {compact ? null : (
        <>
          <p className="dossier-reason">同一组题、同一环境，只改变是否明确提示 Agent 使用记忆。</p>

          <dl className="fact-grid">
            <div><dt>无提示最佳</dt><dd>Causal Memory · 13/20</dd></div>
            <div><dt>有提示最佳</dt><dd>Causal / Graph · 15/20</dd></div>
            <div><dt>评测故障</dt><dd>{benchmark.remainingHandlerFailures} 次</dd></div>
          </dl>
        </>
      )}

      {reportHref ? (
        <a className="dossier-link" href={reportHref}>
          <span>查看完整报告</span>
          <span aria-hidden="true">→</span>
        </a>
      ) : null}
    </article>
  );
}
