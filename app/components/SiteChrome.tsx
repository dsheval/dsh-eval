/* eslint-disable @next/next/no-html-link-for-pages -- Shared navigation spans independently deployed applications and uses full document navigation. */

type NavKey = 'about' | 'methodology' | 'results' | 'faq' | 'top100';

const navLinks: { href: string; key: NavKey; label: string }[] = [
  { href: '/', key: 'about', label: '首页' },
  { href: '/top100/', key: 'top100', label: 'Top100' },
  { href: '/results', key: 'results', label: '评测结果' },
  { href: '/methodology', key: 'methodology', label: '评测方法' },
  { href: '/faq', key: 'faq', label: '常见问题' },
];

export function Brand() {
  return <span className="dsh-brand" translate="no"><strong>DSH</strong><span aria-hidden="true">/</span><b>EVAL</b></span>;
}

export function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function NavigationLinks({ active }: { active?: NavKey }) {
  return navLinks.map((link) => <a aria-current={link.key === active ? 'page' : undefined} href={link.href} key={link.href}>{link.label}</a>);
}

export function SiteHeader({ active }: { active?: NavKey }) {
  return (
    <header className="dsh-site-header">
      <div className="dsh-site-container dsh-header-inner">
        <a className="dsh-brand-link" href="/" aria-label="DSH-Eval 首页"><Brand /></a>
        <nav className="dsh-desktop-nav" aria-label="DSH-Eval 主导航"><NavigationLinks active={active} /></nav>
        <details className="dsh-mobile-menu">
          <summary>菜单<span className="dsh-menu-icon" aria-hidden="true" /></summary>
          <nav aria-label="DSH-Eval 移动端导航"><NavigationLinks active={active} /></nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="dsh-site-footer">
      <div className="dsh-site-container dsh-footer-inner">
        <div className="dsh-footer-intro">
          <a className="dsh-brand-link" href="/" aria-label="DSH-Eval 首页"><Brand /></a>
          <p>公开评测，发现值得关注的项目。</p>
        </div>
        <nav className="dsh-footer-links" aria-label="页脚导航">
          <a href="https://github.com/dsheval/dsh-eval" target="_blank" rel="noopener noreferrer">评测源码 <span aria-hidden="true">↗</span><span className="dsh-visually-hidden">（新窗口打开）</span></a>
          <a href="https://github.com/dsheval/dsh-top100" target="_blank" rel="noopener noreferrer">Top100 源码 <span aria-hidden="true">↗</span><span className="dsh-visually-hidden">（新窗口打开）</span></a>
          <a href="/faq">常见问题</a>
        </nav>
        <span className="dsh-copyright">© 2026 DSH-Eval</span>
      </div>
    </footer>
  );
}
