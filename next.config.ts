import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      { source: '/results/deep-research/v12', destination: '/results/deep-research/2026-09-04', permanent: true },
      { source: '/results/memory/locomo20-2026-08-28', destination: '/results/memory/2026-08-28', permanent: true },
    ];
  },
};

export default nextConfig;
