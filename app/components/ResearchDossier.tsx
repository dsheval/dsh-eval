import { researchDate, researchLongformPassCount, researchPluginCount, researchUrl } from '../data/deep-research';

export default function ResearchDossier() {
  return <article className="dossier homepage-dossier">
    <header className="dossier-head"><span>发布于 {researchDate}</span><span>已完成测试</span></header>
    <div className="dossier-task"><span className="field-label">最新评测 · 深度研究</span><p>研究插件，能交出完整报告吗？</p></div>
    <div className="dossier-verdict">
      <div><span className="field-label">本轮观察</span><h2>仅 {researchLongformPassCount} 个插件</h2><p>通过了其中一道报告题</p></div>
      <dl className="confidence-block"><div><dt>参评插件</dt><dd>{researchPluginCount} 个</dd></div><div><dt>报告题目</dt><dd>2 道</dd></div></dl>
    </div>
    <p className="dossier-reason">dsh-search-boost 通过了金融报告题；其余插件的两道报告题均为部分完成。</p>
    <dl className="fact-grid"><div><dt>本轮第一</dt><dd>dsh-search-boost</dd></div><div><dt>报告题通过</dt><dd>1 / 2 道</dd></div><div><dt>适用范围</dt><dd>本轮固定小样本</dd></div></dl>
    <a className="dossier-link" href={researchUrl}><span>查看完整报告</span><span aria-hidden="true">→</span></a>
  </article>;
}
