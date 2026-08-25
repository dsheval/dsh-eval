import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://dsheval.ai'),
  title: 'DSH Eval · 有证据的插件选择',
  description: '面向 DSH 插件生态的评测与推荐 Agent。真实运行、可信证据、个性化推荐。',
  alternates: {
    canonical: '/dsheval',
  },
  icons: {
    icon: '/dsheval/favicon.svg',
  },
  openGraph: {
    url: '/dsheval',
    title: 'DSH Eval · 有证据的插件选择',
    description: '选插件，别只看谁更火。用真实运行与可信证据，找到更适合当前任务的插件。',
    siteName: 'DSH Eval',
    type: 'website',
    images: [
      {
        url: '/dsheval/og.png',
        width: 1731,
        height: 909,
        alt: 'DSH Eval：选插件，别只看谁更火。',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DSH Eval · 有证据的插件选择',
    description: '选插件，别只看谁更火。用真实运行与可信证据，找到更适合当前任务的插件。',
    images: ['/dsheval/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
