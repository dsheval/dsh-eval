// Old Top100 links used the root page. Fragments never reach the gateway,
// so only links with an explicit legacy destination are redirected here.
(() => {
  const url = new URL(window.location.href);
  if (url.pathname !== '/') return;

  const page = url.searchParams.get('page');
  if (page === 'dsheval' || url.hash === '#dsheval') {
    url.searchParams.delete('page');
    url.hash = '';
    window.location.replace(`${url.pathname}${url.search}`);
    return;
  }

  const pages = new Set(['ranking', 'docs', 'dsh']);
  const views = new Set(['top100', 'hot', 'rising', 'all', 'total', 'category', 'search']);
  const oldFragment = /^#(?:ranking|docs|dsh)(?:-|$)/.test(url.hash);
  if (pages.has(page) || views.has(url.searchParams.get('view')) ||
      url.searchParams.has('category') || oldFragment) {
    // The Top100 shell chooses its panel from ?page=; a fragment alone would
    // otherwise scroll to a section in a hidden installation/docs panel.
    const panel = url.hash.match(/^#(docs|dsh)(?:-|$)/)?.[1];
    if (!pages.has(page) && panel) url.searchParams.set('page', panel);
    window.location.replace(`/top100/${url.search}${url.hash}`);
  }
})();
