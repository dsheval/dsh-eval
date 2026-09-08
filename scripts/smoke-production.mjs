// Read-only checks against the complete Nginx + Node service, not bare Vinext.
// These requests never run an evaluation or invoke third-party plugins.
const base = new URL(process.argv[2] || 'http://127.0.0.1:3000').origin;
const pages = [
  ['/', '万物皆可测'],
  ['/about', 'product-intro-page'],
  ['/methodology', 'inner-page-hero'],
  ['/methodology/memory', 'memory-protocol-timeline'],
  ['/methodology/deep-research', 'research-protocol-page'],
  ['/results', 'results-index-list'],
  ['/results/memory/2026-08-28', 'verification-run-sequence'],
  ['/results/deep-research/2026-09-04', 'research-overview'],
];
const pageNames = {
  '/methodology': '评测方法',
  '/methodology/memory': '跨会话记忆评测方法',
  '/methodology/deep-research': '深度研究评测方法',
  '/results': '评测结果',
  '/results/memory/2026-08-28': '跨会话记忆评测报告',
  '/results/deep-research/2026-09-04': '深度研究评测报告',
};
const oldReportPaths = [
  ['/results/deep-research/v12', '/results/deep-research/2026-09-04'],
  ['/results/memory/locomo20-2026-08-28', '/results/memory/2026-08-28'],
];
for (const [oldPath, newPath] of oldReportPaths) {
  const response = await fetch(`${base}${oldPath}?from=shared`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  const destination = new URL(response.headers.get('location') || '', base);
  if (response.status !== 308 || destination.pathname !== newPath || destination.search !== '?from=shared') {
    throw new Error(`Report redirect failed: ${oldPath}`);
  }
  console.log(`PASS report redirect ${oldPath}`);
}

const faqRedirect = await fetch(`${base}/faq?from=shared`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
const faqDestination = new URL(faqRedirect.headers.get('location') || '', base);
if (faqRedirect.status !== 308 || faqDestination.pathname !== '/about' || faqDestination.hash !== '#faq' || faqDestination.search !== '?from=shared') {
  throw new Error('FAQ redirect must preserve the query and point to /about#faq');
}
console.log('PASS FAQ redirect');

const assets = new Set();
const icons = [
  ['/favicon-a.svg?v=20260908-slashed-d1', 'image/svg+xml'],
  ['/favicon-a.png?v=20260908-slashed-d1', 'image/png'],
  ['/apple-touch-icon-a.png?v=20260908-slashed-d1', 'image/png'],
];
// Standalone brand art and old bookmarks remain available without requiring
// them to appear as link elements in the wordmark-only page navigation.
const additionalBrandAssets = [
  ['/brand-mark.svg?v=20260908-slashed-d1', 'image/svg+xml'],
  ['/favicon-a.svg', 'image/svg+xml'],
  ['/favicon-a.png', 'image/png'],
  ['/apple-touch-icon-a.png', 'image/png'],
  ['/favicon.svg', 'image/svg+xml'],
  ['/favicon.png', 'image/png'],
  ['/apple-touch-icon.png', 'image/png'],
];

function request(path) {
  return fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
}

for (const [path, expected] of pages) {
  const response = await request(path);
  const html = await response.text();
  if (!response.ok || !html.includes(expected) || !response.headers.get('content-type')?.includes('text/html')) {
    throw new Error(`Page failed: ${path}, HTTP ${response.status}`);
  }
  if ([...html.matchAll(/<h1(?:\s|>)/g)].length !== 1) throw new Error(`Expected one h1: ${path}`);
  if (path === '/results') {
    const reportList = html.match(/<section[^>]*class="results-index-list"[^>]*>([\s\S]*?)<\/section>/)?.[1] || '';
    for (const reportPath of ['/results/deep-research/2026-09-04', '/results/memory/2026-08-28']) {
      if (!reportList.includes(`href="${reportPath}"`)) throw new Error(`Missing report link: ${reportPath}`);
    }
    if ([...reportList.matchAll(/class="results-index-report"/g)].length !== 2 || [...reportList.matchAll(/已完成测试/g)].length !== 2) {
      throw new Error('Expected two completed public reports');
    }
  }
  const pageName = pageNames[path];
  if (pageName) {
    const title = `${pageName} · DSH-Eval`;
    if (!html.includes(`<title>${title}</title>`)) throw new Error(`Wrong page title: ${path}`);
    const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '');
    if (heading !== pageName) throw new Error(`Wrong page heading: ${path}`);
  }
  if (path === '/about') {
    const faq = html.match(/<section[^>]*id="faq"[^>]*>([\s\S]*?)<\/section>/)?.[1] || '';
    if ([...faq.matchAll(/<details(?:\s|>)/g)].length !== 6 || /<details[^>]*\bopen\b/.test(faq)) throw new Error('Expected six collapsed FAQs');
    for (const marker of ['<title>DSH-Eval 是什么 · 产品介绍</title>', '万物皆可测', 'DeepSeek Harness', '五个环节设计', 'id="faq"', 'FAQPage', '如何提交项目或对结果提出异议？']) {
      if (!html.includes(marker)) throw new Error(`Missing product introduction: ${marker}`);
    }
  }
  const nav = html.match(/<nav[^>]*aria-label="DSH-Eval 主导航"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
  const navHrefs = [...nav.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  if (JSON.stringify(navHrefs) !== JSON.stringify(['/', '/top100/', '/results', '/methodology', '/about'])) {
    throw new Error(`Wrong primary navigation order: ${path}`);
  }
  if (path.startsWith('/results/')) {
    for (const id of ['report-results', 'report-verification', 'report-resources']) {
      if (!html.includes(`id="${id}"`) || !html.includes(`href="#${id}"`)) throw new Error(`Missing report section: ${path}, ${id}`);
    }
  }

  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/);
  if (!canonical || new URL(canonical[1]).href !== `https://www.dsheval.ai${path}`) throw new Error(`Wrong canonical: ${path}`);
  if (html.includes('https://dsheval.ai')) throw new Error(`Old domain in page metadata or links: ${path}`);
  if (!html.includes('href="/top100/"')) throw new Error(`Missing Top100 navigation: ${path}`);
  for (const marker of ['class="dsh-site-header dsh-nav-emphasis"', 'class="dsh-site-footer"', 'class="dsh-mobile-menu"', '公开评测，发现值得关注的项目。', '© 2026 DSH-Eval', 'href="/site-chrome.css?v=20260908-nav3"']) {
    if (!html.includes(marker)) throw new Error(`Missing shared website shell: ${path}, ${marker}`);
  }
  if (oldReportPaths.some(([oldPath]) => html.includes(`href="${oldPath}"`))) throw new Error(`Old report link remains: ${path}`);
  if (/(?:href|src)="\/dsheval(?:\/|")/.test(html)) throw new Error(`Old evaluation path remains: ${path}`);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (match[1].includes('/_next/static/')) {
      const url = new URL(match[1], base);
      if (url.origin === base) assets.add(url.href);
    }
  }
  for (const [icon] of icons) {
    if (!html.includes(`href="${icon}"`)) throw new Error(`Missing shared icon: ${path}, ${icon}`);
  }
  console.log(`PASS page ${path}`);
}

if (![...assets].some(url => url.endsWith('.css')) || ![...assets].some(url => url.endsWith('.js'))) {
  throw new Error('Expected production CSS and JS references');
}
for (const url of assets) {
  const response = await request(url);
  const body = await response.text();
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !body.length || type.includes('text/html')) {
    throw new Error(`Asset failed: ${new URL(url).pathname}`);
  }
}

for (const [path, type] of [...icons, ...additionalBrandAssets]) {
  const response = await request(path);
  if (!response.ok || !response.headers.get('content-type')?.includes(type) || !(await response.arrayBuffer()).byteLength) {
    throw new Error(`Icon failed: ${path}`);
  }
}

const dataResponse = await request('/eval-data/memory/locomo20-2026-08-28.json');
if (!dataResponse.ok) throw new Error(`Data failed: HTTP ${dataResponse.status}`);
const data = await dataResponse.json();
if (data.pluginCount !== 7 || data.sampleSizePerTrack !== 20 || data.totalPluginTaskRecords !== 280) {
  throw new Error('Unexpected benchmark data');
}
const sitemap = await request('/sitemap.xml');
const sitemapText = await sitemap.text();
if (!sitemap.ok || !sitemapText.includes('https://www.dsheval.ai/about</loc>') || !sitemapText.includes('/methodology/memory') || !sitemapText.includes('/methodology/deep-research') || !sitemapText.includes('/results/deep-research/2026-09-04')) {
  throw new Error('Sitemap failed');
}
if (!sitemapText.includes('/results/memory/2026-08-28') || oldReportPaths.some(([oldPath]) => sitemapText.includes(oldPath))) throw new Error('Sitemap must use dated report URLs');
const sitemapLocations = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]));
if (sitemapLocations.some((url) => url.pathname === '/faq') || sitemapLocations.length !== pages.length || sitemapLocations.some((url) => url.origin !== 'https://www.dsheval.ai')) {
  throw new Error('Sitemap must list every page on the www origin');
}
const researchResponse = await request('/eval-data/deep-research/v12/results.json');
if (!researchResponse.ok) throw new Error('Deep Research download failed');
const research = await researchResponse.json();
if (research.records?.length !== 40 || research.suiteId !== 'dsh-research-eval-v12-r3-refresh') {
  throw new Error('Unexpected Deep Research snapshot');
}
const robots = await request('/robots.txt');
const robotsText = await robots.text();
if (!robots.ok || !robotsText.includes('https://www.dsheval.ai/sitemap.xml') || !robotsText.includes('https://www.dsheval.ai/top100/sitemap.xml')) {
  throw new Error('Robots must advertise both website sitemaps');
}
const legacyScript = await request('/legacy-top100.js');
if (!legacyScript.ok || !(await legacyScript.text()).includes('/top100/')) throw new Error('Missing legacy link compatibility script');
const chromeStyle = await request('/site-chrome.css');
if (!chromeStyle.ok || !chromeStyle.headers.get('content-type')?.includes('text/css')) throw new Error('Missing shared website shell stylesheet');
console.log(`PASS ${assets.size} production assets, benchmark JSON and sitemap`);
