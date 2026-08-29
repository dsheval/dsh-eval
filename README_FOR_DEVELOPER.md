# DSH Eval Homepage Frontend

这是 DSH Eval 的独立开发仓库。它包含网站前端，以及从 `dsh-top100` 迁入的记忆插件评测套件；不依赖原仓库即可继续运行和开发评测。

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

- `app/page.tsx`：官网主体结构、Top100 入口和评测方法内容。
- `app/components/RecommendationDemo.tsx`：首页推荐报告交互演示。
- `app/globals.css`：全站视觉样式和响应式布局。
- `app/layout.tsx`：页面标题、SEO、Open Graph 和分享图配置。
- `public/og.png`：社交平台分享预览图。
- `app/components/MemoryBenchmark.tsx`：记忆插件双轨协议、排名和过程指标。
- `public/data/memory/`：评测运行器导出的脱敏榜单快照。
- `evals/memory/`：可独立执行的记忆评测代码、题集、协议、评分与单测。

## 生产配置

1. 应用部署在 `https://dsheval.ai/dsheval`，`next.config.ts` 中的 `basePath` 已设为 `/dsheval`。
2. `app/page.tsx` 中的 `TOP100_URL` 指向现有线上 `https://dsheval.ai/`。
3. 首页推荐报告仍是产品结构演示；Memory Benchmark 区域读取 `public/data/memory` 的真实评测快照。
4. `app/layout.tsx` 的 canonical 和分享元数据按生产地址配置。

## 包内未包含

- `node_modules`
- 构建产物与本机缓存
- `.env`、密钥或服务器凭据
- 逐题原始回答、DSH 会话、插件数据库与本机运行日志
