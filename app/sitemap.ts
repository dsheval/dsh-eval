import type { MetadataRoute } from 'next';

const ORIGIN = 'https://dsheval.ai';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${ORIGIN}/dsheval`,
      lastModified: new Date('2026-09-04'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${ORIGIN}/dsheval/results`,
      lastModified: new Date('2026-09-04'),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${ORIGIN}/dsheval/results/deep-research/v12`,
      lastModified: new Date('2026-09-04'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${ORIGIN}/dsheval/results/memory/locomo20-2026-08-28`,
      lastModified: new Date('2026-09-02'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${ORIGIN}/dsheval/methodology`,
      lastModified: new Date('2026-09-02'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${ORIGIN}/dsheval/methodology/memory`,
      lastModified: new Date('2026-09-02'),
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${ORIGIN}/dsheval/methodology/deep-research`,
      lastModified: new Date('2026-09-04'),
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${ORIGIN}/dsheval/faq`,
      lastModified: new Date('2026-09-02'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}
