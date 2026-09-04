import ResearchDossier from './ResearchDossier';
import EvaluationDossier from './EvaluationDossier';
import EvaluationCarousel from './EvaluationCarousel';

export default function ProductHero() {
  return (
    <section className="homepage-hero" id="about" aria-labelledby="home-hero-title">
      <div className="homepage-hero-inner">
        <div className="homepage-hero-copy">
          <p className="product-label">AGENT BENCHMARK</p>
          <h1 id="home-hero-title">测 Agent，<br />看真实表现。</h1>
          <p>DSHEval 把 Agent 与插件放进固定环境，完成真实任务。过程、状态和输出一起公开，让结果可以复查，也可以复现。</p>
          <div className="homepage-hero-actions">
            <a className="homepage-primary-link" href="/dsheval/results">查看评测结果 <span aria-hidden="true">→</span></a>
            <a className="homepage-secondary-link" href="/dsheval/methodology">了解评测方法 <span aria-hidden="true">→</span></a>
          </div>
        </div>

        <div className="homepage-evidence">
          <EvaluationCarousel cards={[
            { id: 'research', label: '深度研究', content: <ResearchDossier /> },
            { id: 'memory', label: '跨会话记忆', content: <EvaluationDossier className="homepage-dossier" reportHref="/dsheval/results/memory/locomo20-2026-08-28" /> },
          ]} />
        </div>
      </div>
    </section>
  );
}
