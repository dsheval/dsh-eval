// Read-only checks against the complete Nginx + Node service, not bare Vinext.
// These requests never run an evaluation or invoke third-party plugins.
const base = new URL(process.argv[2] || 'http://127.0.0.1:3000').origin;
const pages = [
  ['/dsheval', '看真实表现'],
  ['/dsheval/', '看真实表现'],
  ['/dsheval/methodology', 'inner-page-hero'],
  ['/dsheval/methodology/memory', 'memory-protocol-timeline'],
  ['/dsheval/results', 'LEVEL 03 · 已完成测试'],
  ['/dsheval/results/memory/locomo20-2026-08-28', 'verification-run-sequence'],
  ['/dsheval/faq', 'inner-page-hero'],
];
const assets = new Set();

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

const dataResponse = await request('/dsheval/data/memory/locomo20-2026-08-28.json');
if (!dataResponse.ok) throw new Error(`Data failed: HTTP ${dataResponse.status}`);
const data = await dataResponse.json();
if (data.pluginCount !== 7 || data.sampleSizePerTrack !== 20 || data.totalPluginTaskRecords !== 280) {
  throw new Error('Unexpected benchmark data');
}
const sitemap = await request('/dsheval/sitemap.xml');
if (!sitemap.ok || !(await sitemap.text()).includes('/dsheval/methodology/memory')) {
  throw new Error('Sitemap failed');
}
console.log(`PASS ${assets.size} production assets, benchmark JSON and sitemap`);
