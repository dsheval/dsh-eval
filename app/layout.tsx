import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://dsheval.ai'),
  title: {
    default: 'DSH-Eval · Agent 与插件公开评测',
    template: '%s',
  },
  description: 'DSH-Eval 在固定环境中执行真实任务，公开 Agent 与插件的测试条件、结果、可公开的证据与适用范围。',
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
    title: 'DSH-Eval · Agent 与插件公开评测',
    description: '让每一项能力结论都建立在真实任务、闭合证据和可复现结果之上。',
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
    title: 'DSH-Eval · Agent 与插件公开评测',
    description: '让每一项能力结论都建立在真实任务、闭合证据和可复现结果之上。',
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
        <link rel="stylesheet" href="/site-chrome.css?v=20260905-nav2" />
        <script src="/legacy-top100.js" defer />
      </head>
      <body>{children}</body>
    </html>
  );
}
