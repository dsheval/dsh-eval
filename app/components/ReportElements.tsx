import type { ReactNode } from 'react';
import Link from 'next/link';

export function DownloadIcon() {
  return <svg className="download-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>;
}

export function ReportHeading({ id, title, sample }: { id: string; title: string; sample: string }) {
  return <div className="report-results-heading" id="report-results">
    <div><p className="section-label" data-site-label="section" lang="en">RESULTS</p><h2 data-site-title="section" className="section-title" id={id}>{title}</h2></div>
    <span className="report-sample-note" data-site-copy="note">{sample}</span>
  </div>;
}

type ReportCoverProps = {
  title: string;
  label: string;
  date: string;
  description: string;
  finding: string;
  context: string;
  facts: ReadonlyArray<readonly [string, string]>;
  methodUrl: string;
};

export function ReportCover({ title, label, date, description, finding, context, facts, methodUrl }: ReportCoverProps) {
  return <header className="report-cover">
    <nav className="inner-page-breadcrumbs" aria-label="面包屑"><ol>
      <li><Link href="/">DSH-Eval</Link></li><li><a href="/results">评测结果</a></li><li><span aria-current="page">{title}</span></li>
    </ol></nav>
    <div className="report-cover-meta"><p data-site-label="page" lang="en">{label}</p><span>发布于 <time dateTime={date}>{date}</time></span></div>
    <h1 data-site-title="page">{title}</h1>
    <p className="report-cover-description" data-site-copy="lead">{description}</p>
    <div className="report-digest">
      <div className="report-finding"><p data-site-label="section" lang="en">KEY FINDING</p><h2>{finding}</h2><p data-site-copy="note">{context}</p></div>
      <dl className="report-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </div>
    <nav className="report-section-nav" aria-label="报告目录">
      <a href="#report-results">结果对比 <span aria-hidden="true">↓</span></a>
      <a href="#report-verification">证据与范围 <span aria-hidden="true">↓</span></a>
      <a href="#report-resources">公开材料 <span aria-hidden="true">↓</span></a>
      <a href={methodUrl}>评测方法 <span aria-hidden="true">→</span></a>
    </nav>
  </header>;
}

export function ReportResources({ dataUrl, dataFilename, codeUrl, children }: { dataUrl: string; dataFilename: string; codeUrl: string; children?: ReactNode }) {
  return <section className="report-resources" id="report-resources" aria-label="公开材料">
    <div className="report-resource-bar"><div><h2 data-site-title="minor">公开材料</h2><p data-site-copy="note">下载数据，查看评测实现。</p></div><div>
      <a href={dataUrl} download={dataFilename}>结果数据（JSON） <DownloadIcon /></a>
      <a href={codeUrl} target="_blank" rel="noreferrer">评测代码 <span aria-hidden="true">↗</span></a>
    </div></div>
    {children ? <details className="report-extra-resources"><summary><span>离线报告与补充材料</span><i aria-hidden="true">+</i></summary><div>{children}</div></details> : null}
  </section>;
}

export function ReportStatus({ evidence, limitation }: { evidence: string; limitation: string }) {
  return <div className="report-verification-summary" id="report-verification">
    <div><strong className="report-status-label">已完成测试</strong><p data-site-copy="note">{evidence}关键结果尚待独立环境复测。</p></div>
    <div><strong className="report-scope-label">样本与范围</strong><p data-site-copy="note">{limitation}</p></div>
  </div>;
}

export function ReportNextLinks() {
  return <nav className="report-next-links" aria-label="继续浏览">
    <a href="/results">查看其他评测 <span aria-hidden="true">→</span></a>
    <a href="/top100/">发现 DSH 插件 <span aria-hidden="true">→</span></a>
  </nav>;
}
