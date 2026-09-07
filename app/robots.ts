import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/data/manifest.json', '/data/snapshots/', '/data/rankings-hot.json'],
      disallow: ['/api/', '/data/'],
    },
    sitemap: ['https://www.dsheval.ai/sitemap.xml', 'https://www.dsheval.ai/top100/sitemap.xml'],
  };
}
