import ResearchDossier from './ResearchDossier';
import EvaluationDossier from './EvaluationDossier';
import EvaluationCarousel from './EvaluationCarousel';

export default function ProductHero() {
  return (
    <section className="homepage-hero" id="about" aria-labelledby="home-hero-title">
      <div className="homepage-hero-inner">
        <div className="homepage-hero-copy">
          <p className="product-label dsh-home-eyebrow" data-site-label="page" lang="en">AGENT BENCHMARK</p>
          <h1 className="dsh-home-title" id="home-hero-title">万物皆可测</h1>
          <p className="dsh-home-description" data-site-copy="lead">DSH-Eval 是面向 DeepSeek Harness（DSH）Agent 与插件的通用测评平台。围绕真实任务、逐题证据与原生基线比较，设计有依据的能力判断。</p>
          <div className="homepage-hero-actions">
            <a className="homepage-primary-link" href="/results">查看评测结果 <span aria-hidden="true">→</span></a>
            <a className="homepage-secondary-link" href="/about">了解 DSH-Eval <span aria-hidden="true">→</span></a>
          </div>
        </div>

        <div className="homepage-evidence">
          <EvaluationCarousel cards={[
            { id: 'research', label: '深度研究', content: <ResearchDossier /> },
            { id: 'memory', label: '跨会话记忆', content: <EvaluationDossier className="homepage-dossier" reportHref="/results/memory/2026-08-28" /> },
          ]} />
        </div>
      </div>
    </section>
  );
}
