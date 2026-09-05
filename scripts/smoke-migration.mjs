// Read-only checks against the combined Caddy + DSH-Eval + Top100 gateway.
// For an isolated local gateway, set MIGRATION_HOST_HEADER=dsheval.ai.
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const base = new URL(process.argv[2] || 'http://127.0.0.1:3382');
const primaryHost = process.env.MIGRATION_HOST_HEADER;
const canonicalOrigin = 'https://dsheval.ai';

async function request(path, www = false) {
  const url = new URL(path, base);
  const headers = {};
  if (primaryHost) headers.Host = www ? `www.${primaryHost}` : primaryHost;
  else if (www) url.hostname = 'www.dsheval.ai';
  // Node fetch can discard a custom Host header; use HTTP directly so local
  // checks exercise the actual virtual hosts, with no DNS or hosts-file edits.
  return new Promise((resolve, reject) => {
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = send(url, { headers, signal: AbortSignal.timeout(15000) }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), {
        status: res.statusCode,
        headers: Object.fromEntries(Object.entries(res.headers).map(([key, value]) => [key, String(value)])),
      })));
    });
    req.on('error', reject);
    req.end();
  });
}

for (const [path, target] of [
  ['/dsheval', '/'],
  ['/dsheval/?from=github', '/?from=github'],
  ['/dsheval/results?from=github', '/results?from=github'],
  ['/dsheval/methodology/memory', '/methodology/memory'],
  ['/dsheval/data/memory/locomo20-2026-08-28.json?download=1', '/eval-data/memory/locomo20-2026-08-28.json?download=1'],
  ['/dsheval/data/deep-research/v12/results.json', '/eval-data/deep-research/v12/results.json'],
  ['/top100?page=dsh', '/top100/?page=dsh'],
  ['/skills.html?category=coding', '/top100/skills.html?category=coding'],
  ['/docs.html', '/top100/docs.html'],
  ['/dsh.html', '/top100/dsh.html'],
  ['/index.html?view=rising', '/top100/index.html?view=rising'],
]) {
  const response = await request(path);
  assert.equal(response.status, 308, path);
  const destination = new URL(response.headers.get('location'), canonicalOrigin);
  assert.equal(destination.href, `${canonicalOrigin}${target}`, path);
  assert.equal((await request(target)).status, 200, `Redirect target: ${target}`);
  console.log(`PASS redirect ${path}`);
}

for (const [path, marker] of [
  ['/', '看真实表现'],
  ['/results', 'result-report-status'],
  ['/top100/', 'data-content-switch="ranking"'],
  ['/top100/?page=dsh', 'data-content-switch="dsh"'],
  ['/top100/skills.html', 'Skills'],
  ['/top100/dsh.html', '安装'],
  ['/top100/docs.html', '排名'],
]) {
  const response = await request(path);
  const html = await response.text();
  assert.equal(response.status, 200, path);
  assert.ok(html.includes(marker), path);
  // Resolve assets as a browser would from the nested URL. This catches the
  // most common subdirectory migration failure without executing a browser.
  for (const match of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|svg|png|ico)(?:\?[^"#]*)?)"/g)) {
    const asset = new URL(match[1], `${canonicalOrigin}${path}`);
    if (asset.origin !== canonicalOrigin) continue;
    const assetResponse = await request(`${asset.pathname}${asset.search}`);
    assert.equal(assetResponse.status, 200, `${path} asset: ${asset.pathname}`);
    assert.ok(!assetResponse.headers.get('content-type')?.includes('text/html'), `HTML fallback for ${asset.pathname}`);
  }
  console.log(`PASS content and assets ${path}`);
}

for (const www of [false, true]) {
  const manifestResponse = await request('/data/manifest.json', www);
  assert.equal(manifestResponse.status, 200, 'Existing data API must not redirect');
  assert.ok(manifestResponse.headers.get('content-type')?.includes('application/json'));
  const manifest = await manifestResponse.json();
  assert.ok(manifest.datasets, 'Expected Top100 manifest');
  const rankingsResponse = await request('/data/rankings-hot.json', www);
  assert.equal(rankingsResponse.status, 200, 'Legacy rankings must not redirect');
  await rankingsResponse.json();
  // GET is intentionally rejected. Do not emit test analytics into production.
  assert.equal((await request('/api/events', www)).status, 405);
  console.log(`PASS ${www ? 'www' : 'primary'} data and events routes`);
}

const wwwPage = await request('/top100/?page=dsh', true);
assert.equal(wwwPage.status, 308);
assert.equal(wwwPage.headers.get('location'), `${canonicalOrigin}/top100/?page=dsh`);
const doubledSlash = await request('/dsheval//example.org/');
assert.equal(doubledSlash.status, 308);
assert.equal(new URL(doubledSlash.headers.get('location'), canonicalOrigin).origin, canonicalOrigin);

const primaryChrome = await request('/site-chrome.css');
const top100Chrome = await request('/top100/site-chrome.css');
assert.equal(primaryChrome.status, 200);
assert.equal(top100Chrome.status, 200);
assert.ok(primaryChrome.headers.get('content-type')?.includes('text/css'));
assert.ok(top100Chrome.headers.get('content-type')?.includes('text/css'));
assert.equal(await primaryChrome.text(), await top100Chrome.text(), 'Both applications must deploy the same shared shell styles');

const robots = await request('/robots.txt');
assert.equal(robots.status, 200);
const robotsText = await robots.text();
assert.ok(robotsText.includes(`${canonicalOrigin}/sitemap.xml`));
assert.ok(robotsText.includes(`${canonicalOrigin}/top100/sitemap.xml`));
for (const path of ['/sitemap.xml', '/top100/sitemap.xml']) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  const xml = await response.text();
  assert.ok(!xml.includes('https://dsheval.ai/dsheval'), path);
  assert.ok(!xml.includes('https://www.dsheval.ai'), path);
}
console.log('PASS combined website migration, standard domain and both sitemaps');
