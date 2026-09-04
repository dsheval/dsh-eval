import type { ReactNode } from 'react';

export function ReportHeading({ id, title, sample }: { id: string; title: string; sample: string }) {
  return <div className="report-results-heading">
    <div><p className="section-label">评测结果</p><h2 className="section-title" id={id}>{title}</h2></div>
    <span className="report-sample-note">{sample}</span>
  </div>;
}

export function ReportConclusion({ children }: { children: ReactNode }) {
  return <p className="report-conclusion"><span>本轮结论</span><strong>{children}</strong></p>;
}

export function ReportResources({ dataUrl, codeUrl, children }: { dataUrl: string; codeUrl: string; children?: ReactNode }) {
  return <section className="report-resources" aria-label="公开材料">
    <div className="report-resource-bar"><h2>公开材料</h2><div>
      <a href={dataUrl} download>下载结果 <span aria-hidden="true">↓</span></a>
      <a href={codeUrl} target="_blank" rel="noreferrer">查看代码 <span aria-hidden="true">↗</span></a>
    </div></div>
    {children ? <details className="report-extra-resources"><summary>更多材料</summary><div>{children}</div></details> : null}
  </section>;
}

export function ReportStatus({ evidence, limitation }: { evidence: string; limitation: string }) {
  return <div className="report-verification-summary">
    <div><h2>已完成测试</h2><p>{evidence}关键结果尚待独立环境复测。</p></div>
    <div><h3>样本与范围</h3><p>{limitation}</p></div>
  </div>;
}

export function ReportNextLinks() {
  return <nav className="report-next-links" aria-label="继续浏览">
    <a href="/dsheval/results">查看其他评测 <span aria-hidden="true">→</span></a>
    <a href="https://dsheval.ai/" target="_blank" rel="noreferrer">发现 DSH 插件 <span aria-hidden="true">↗</span></a>
  </nav>;
}
