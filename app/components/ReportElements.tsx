import Link from 'next/link';

export function DownloadIcon() {
  return <svg className="download-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>;
}

export function ReportHeading({ id, title, sample }: { id: string; title: string; sample: string }) {
  return <div className="report-results-heading" id="report-results">
    <div><h2 data-site-title="section" className="section-title" id={id}>{title}</h2></div>
    <span className="report-sample-note" data-site-copy="note">{sample}</span>
  </div>;
}

type ReportCoverProps = {
  title: string;
  date: string;
  finding: string;
  scope: string;
};

export function ReportCover({ title, date, finding, scope }: ReportCoverProps) {
  return <header className="report-cover">
    <div className="report-cover-meta"><Link href="/results">← 评测结果</Link><time dateTime={date}>{date}</time></div>
    <h1 data-site-title="page">{title}</h1>
    <p className="report-cover-description" data-site-copy="lead">{finding}</p>
    <p className="report-scope-line" data-site-copy="note">{scope}</p>
  </header>;
}

export function ReportResources({ dataUrl, dataFilename, codeUrl }: { dataUrl: string; dataFilename: string; codeUrl: string }) {
  return <details className="report-resources report-disclosure" id="report-resources">
    <summary><h2 className="verification-disclosure-title" data-site-title="minor">下载数据与公开材料</h2><i aria-hidden="true">+</i></summary>
    <div className="report-download-links">
      <a href={dataUrl} download={dataFilename}>结果数据（JSON） <DownloadIcon /></a>
      <a href={codeUrl} target="_blank" rel="noreferrer">评测代码 <span aria-hidden="true">↗</span></a>
    </div>
  </details>;
}

export function ReportStatus({ limitation }: { limitation: string }) {
  return <p className="report-scope-note" id="report-verification" data-site-copy="note">{limitation}关键结果尚待独立环境复测。</p>;
}
