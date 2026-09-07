import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.dsheval.ai'),
  title: {
    default: 'DSH-Eval · 万物皆可测',
    template: '%s',
  },
  description: 'DSH-Eval 是面向 DeepSeek Harness（DSH）Agent 与插件的通用测评平台。了解产品方法设计、独立测评报告与 Top100 发现栏目。',
  alternates: {
    canonical: '/',
  },
  creator: 'DSH-Eval',
  publisher: 'DSH-Eval',
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon-a.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-a.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: { url: '/apple-touch-icon-a.png', sizes: '180x180', type: 'image/png' },
  },
  openGraph: {
    url: '/',
    title: 'DSH-Eval · 万物皆可测',
    description: '面向 DeepSeek Harness（DSH）Agent 与插件的通用测评平台，围绕任务、逐题证据与原生基线比较设计。',
    siteName: 'DSH-Eval',
    type: 'website',
    locale: 'zh_CN',
    images: [
      {
        url: '/og.png',
        width: 1731,
        height: 909,
        alt: 'DSH-Eval：Agent 与插件公开评测。',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DSH-Eval · 万物皆可测',
    description: '面向 DeepSeek Harness（DSH）Agent 与插件的通用测评平台，围绕任务、逐题证据与原生基线比较设计。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* eslint-disable-next-line @next/next/no-css-tags -- Keep this stylesheet byte-identical to the independently deployed Top100 shell. */}
        <link rel="stylesheet" href="/site-chrome.css?v=20260905-type8c" />
        <script src="/legacy-top100.js" defer />
      </head>
      <body>{children}</body>
    </html>
  );
}
