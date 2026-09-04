import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://dsheval.ai'),
  title: {
    default: 'DSHEval · DSH Agent 与插件自动化评测基础设施',
    template: '%s',
  },
  description: 'DSHEval 在可恢复测试环境中执行真实任务，采集运行与环境证据，输出可解释、可复现的 DSH Agent 与插件评测结果。',
  alternates: {
    canonical: '/dsheval',
  },
  creator: 'DSHEval',
  publisher: 'DSHEval',
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/dsheval/favicon-a.png', type: 'image/png', sizes: '32x32' },
      { url: '/dsheval/favicon-a.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: { url: '/dsheval/apple-touch-icon-a.png', sizes: '180x180', type: 'image/png' },
  },
  openGraph: {
    url: '/dsheval',
    title: 'DSHEval · DSH Agent 与插件自动化评测基础设施',
    description: '让每一项能力结论都建立在真实任务、闭合证据和可复现结果之上。',
    siteName: 'DSHEval',
    type: 'website',
    locale: 'zh_CN',
    images: [
      {
        url: '/dsheval/og.png',
        width: 1731,
        height: 909,
        alt: 'DSHEval：DSH Agent 与插件自动化评测基础设施。',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DSHEval · DSH Agent 与插件自动化评测基础设施',
    description: '让每一项能力结论都建立在真实任务、闭合证据和可复现结果之上。',
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
