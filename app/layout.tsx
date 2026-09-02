import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://dsheval.ai'),
  title: 'DSHEval · Agent 真实任务评测',
  description: '在统一运行环境中测试 Agent 的真实任务表现，公开结果、评测方法和可复查记录。',
  alternates: {
    canonical: '/dsheval',
  },
  icons: {
    icon: '/dsheval/favicon.svg',
  },
  openGraph: {
    url: '/dsheval',
    title: 'DSHEval · Agent 真实任务评测',
    description: '固定版本和运行环境，执行真实任务，并公开可复查、可复现的评测结果。',
    siteName: 'DSHEval',
    type: 'website',
    images: [
      {
        url: '/dsheval/og.png',
        width: 1731,
        height: 909,
        alt: 'DSHEval：在统一条件下测试 Agent 的真实任务表现。',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DSHEval · Agent 真实任务评测',
    description: '在统一条件下测试 Agent 的真实任务表现，结果可复查、可复现。',
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
