const TOP100_URL = 'https://dsheval.ai/';

type NavKey = 'about' | 'methodology' | 'results' | 'faq';

const navLinks = [
  { href: '/dsheval/#about', key: 'about', label: '产品介绍', external: false },
  { href: '/dsheval/methodology', key: 'methodology', label: '评测方法', external: false },
  { href: '/dsheval/results', key: 'results', label: '评测结果', external: false },
  { href: '/dsheval/faq', key: 'faq', label: '常见问题', external: false },
  { href: TOP100_URL, key: null, label: 'Top100', external: true },
];

export function Brand() {
  return (
    <span className="brand-lockup" translate="no">
      <strong className="brand-dsh">DSH</strong>
      <span className="brand-slash" aria-hidden="true">/</span>
      <b className="brand-eval">EVAL</b>
    </span>
  );
}

export function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export function SiteHeader({ active }: { active?: NavKey }) {
  return (
    <header className="site-header site-header-classic site-header-minimal">
      <a href="/dsheval/#about" className="brand-link" aria-label="DSHEval 首页"><Brand /></a>
      <nav className="desktop-nav" aria-label="主导航">
        {navLinks.map((link) => (
          <a
            aria-label={link.external ? `${link.label}（新窗口打开）` : undefined}
            aria-current={link.key === active ? 'page' : undefined}
            href={link.href}
            key={link.href}
            rel={link.external ? 'noreferrer' : undefined}
            target={link.external ? '_blank' : undefined}
          >
            {link.label}{link.external ? <span aria-hidden="true"> ↗</span> : null}
          </a>
        ))}
      </nav>
      <details className="mobile-nav">
        <summary><span>菜单</span><i aria-hidden="true" /></summary>
        <nav aria-label="移动端导航">
          {navLinks.map((link) => (
            <a
              aria-current={link.key === active ? 'page' : undefined}
              href={link.href}
              key={link.href}
              rel={link.external ? 'noreferrer' : undefined}
              target={link.external ? '_blank' : undefined}
            >
              {link.label}{link.external ? <span aria-hidden="true"> ↗</span> : null}
            </a>
          ))}
        </nav>
      </details>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer site-footer-classic">
      <a href="/dsheval" aria-label="返回 DSHEval 首页"><Brand /></a>
      <p>验证真实能力，并公开证据。</p>
      <div><a href="/dsheval/#about">产品介绍</a><a href="/dsheval/methodology">评测方法</a><a href="/dsheval/results">评测结果</a><a href="/dsheval/faq">常见问题</a></div>
      <span>© 2026 DSHEval</span>
    </footer>
  );
}
