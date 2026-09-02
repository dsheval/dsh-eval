# DSHEval 官网与评测结果站

这是 DSHEval 的独立开发仓库。它包含产品官网、评测结果页，以及从 `dsh-top100` 迁入的记忆能力评测套件；不依赖原仓库即可继续运行和开发评测。

## 本地运行

环境要求：Node.js 22.13 或更高版本。

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 3000
```

然后打开：`http://localhost:3000/dsheval`

## 交付前检查

```bash
npm run lint
npm run test:memory
npm run build
```

## 主要文件

- `app/page.tsx`：产品官网首页，负责说明 DSHEval 是什么、如何评测以及与 Top100 的关系。
- `app/results/page.tsx`：公开评测结果中心。
- `app/results/memory/locomo20-2026-08-28/page.tsx`：首个记忆能力评测结果详情。
- `app/methodology/memory/page.tsx`：记忆能力评测协议与证据要求。
- `app/components/ProductHero.tsx`：首页产品定义和证据链主视觉。
- `app/components/SiteChrome.tsx`：公共页头、页脚与品牌导航。
- `app/components/EvaluationEvidence.tsx`：可展开的评测证据和分级说明。
- `app/globals.css`：全站视觉样式和响应式布局。
- `app/layout.tsx`：页面标题、SEO、Open Graph 和分享图配置。
- `app/sitemap.ts`：生成 `/dsheval/sitemap.xml`。
- `public/og.png`：社交平台分享预览图。
- `app/components/MemoryBenchmark.tsx`：记忆插件双轨协议、排名和过程指标。
- `public/data/memory/`：评测运行器导出的脱敏榜单快照。
- `evals/memory/`：可独立执行的记忆评测代码、题集、协议、评分与单测。

## 生产配置

1. 应用部署在 `https://dsheval.ai/dsheval`，`next.config.ts` 中的 `basePath` 已设为 `/dsheval`。
2. `app/page.tsx` 中的 `TOP100_URL` 指向现有线上 `https://dsheval.ai/`。
3. 首页只展示最新评测摘要；完整 Memory Benchmark 位于独立结果详情页，并读取 `public/data/memory` 的真实评测快照。
4. 各公开页面已经配置独立标题、描述、canonical 和结构化数据。
5. 应用会发布 `https://dsheval.ai/dsheval/sitemap.xml`。由于搜索引擎只读取根域 `robots.txt`，部署时还需要在 Top100/网关层维护 `https://dsheval.ai/robots.txt`，允许主流搜索与 AI 搜索爬虫，并同时列出 Top100 和 DSHEval 的 sitemap。

## 包内未包含

- `node_modules`
- 构建产物与本机缓存
- `.env`、密钥或服务器凭据
- 逐题原始回答、DSH 会话、插件数据库与本机运行日志
