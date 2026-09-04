// Read-only checks against the complete Nginx + Node service, not bare Vinext.
// These requests never run an evaluation or invoke third-party plugins.
const base = new URL(process.argv[2] || 'http://127.0.0.1:3000').origin;
const pages = [
  ['/dsheval', '看真实表现'],
  ['/dsheval/', '看真实表现'],
  ['/dsheval/methodology', 'inner-page-hero'],
  ['/dsheval/methodology/memory', 'memory-protocol-timeline'],
  ['/dsheval/methodology/deep-research', 'research-protocol-page'],
  ['/dsheval/results', 'result-report-status'],
  ['/dsheval/results/memory/locomo20-2026-08-28', 'verification-run-sequence'],
  ['/dsheval/results/deep-research/v12', 'research-overview'],
  ['/dsheval/faq', 'inner-page-hero'],
];
const assets = new Set();
const icons = [
  ['/dsheval/favicon-a.svg', 'image/svg+xml'],
  ['/dsheval/favicon-a.png', 'image/png'],
  ['/dsheval/apple-touch-icon-a.png', 'image/png'],
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

for (const [path, type] of icons) {
  const response = await request(path);
  if (!response.ok || !response.headers.get('content-type')?.includes(type) || !(await response.arrayBuffer()).byteLength) {
    throw new Error(`Icon failed: ${path}`);
  }
}

const dataResponse = await request('/dsheval/data/memory/locomo20-2026-08-28.json');
if (!dataResponse.ok) throw new Error(`Data failed: HTTP ${dataResponse.status}`);
const data = await dataResponse.json();
if (data.pluginCount !== 7 || data.sampleSizePerTrack !== 20 || data.totalPluginTaskRecords !== 280) {
  throw new Error('Unexpected benchmark data');
}
const sitemap = await request('/dsheval/sitemap.xml');
const sitemapText = await sitemap.text();
if (!sitemap.ok || !sitemapText.includes('/dsheval/methodology/memory') || !sitemapText.includes('/dsheval/methodology/deep-research') || !sitemapText.includes('/dsheval/results/deep-research/v12')) {
  throw new Error('Sitemap failed');
}
const researchResponse = await request('/dsheval/data/deep-research/v12/results.json');
if (!researchResponse.ok) throw new Error('Deep Research download failed');
const research = await researchResponse.json();
if (research.records?.length !== 40 || research.suiteId !== 'dsh-research-eval-v12-r3-refresh') {
  throw new Error('Unexpected Deep Research snapshot');
}
console.log(`PASS ${assets.size} production assets, benchmark JSON and sitemap`);
