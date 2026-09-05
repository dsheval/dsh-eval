import ResearchDossier from './ResearchDossier';
import EvaluationDossier from './EvaluationDossier';
import EvaluationCarousel from './EvaluationCarousel';

export default function ProductHero() {
  return (
    <section className="homepage-hero" id="about" aria-labelledby="home-hero-title">
      <div className="homepage-hero-inner">
        <div className="homepage-hero-copy">
          <p className="product-label dsh-home-eyebrow" data-site-label="page" lang="en">AGENT BENCHMARK</p>
          <h1 className="dsh-home-title" id="home-hero-title">测 Agent，<br />看真实表现</h1>
          <p className="dsh-home-description" data-site-copy="lead">DSH-Eval 把 Agent 与插件放进固定环境，完成真实任务。公开测试条件、结果和可公开的证据，说明每份报告能复查什么、还存在哪些限制。</p>
          <div className="homepage-hero-actions">
            <a className="homepage-primary-link" href="/results">查看评测结果 <span aria-hidden="true">→</span></a>
            <a className="homepage-secondary-link" href="/methodology">了解评测方法 <span aria-hidden="true">→</span></a>
          </div>
        </div>

        <div className="homepage-evidence">
          <EvaluationCarousel cards={[
            { id: 'research', label: '深度研究', content: <ResearchDossier /> },
            { id: 'memory', label: '跨会话记忆', content: <EvaluationDossier className="homepage-dossier" reportHref="/results/memory/locomo20-2026-08-28" /> },
          ]} />
        </div>
      </div>
    </section>
  );
}
