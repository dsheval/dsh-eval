export function ProductIdentity() {
  return (
    <section className="product-intro-section official-information" id="official" aria-labelledby="official-title">
      <header className="reading-section-heading">
        <h2 className="section-title" id="official-title">官方信息</h2>
      </header>
      <div className="official-information-content">
        <dl className="product-identity" aria-label="DSH-Eval 官方网站与源码">
          <div>
            <dt>官方网站</dt>
            <dd><a href="https://www.dsheval.ai/">https://www.dsheval.ai/</a></dd>
          </div>
          <div>
            <dt>官方 GitHub 仓库 · 评测与网站源码</dt>
            <dd><a href="https://github.com/dsheval/dsh-eval">https://github.com/dsheval/dsh-eval</a></dd>
          </div>
        </dl>
        <p><a href="/top100/">Top100</a> 是 DSH-Eval 旗下的插件与 Skills 发现栏目，收录或热度排名不代表已经通过能力评测。</p>
        <p>引用评测结论时，请以公开报告注明的代码、版本和测试环境为准。</p>
      </div>
    </section>
  );
}
