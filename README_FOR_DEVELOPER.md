# DSHEval 官网与评测结果站

这是 DSHEval 的独立开发仓库。它包含产品官网、评测结果页，以及从 `dsh-top100` 迁入的记忆能力评测套件；不依赖原仓库即可继续运行和开发评测。

## 本地运行

环境要求：Node.js 22.13 或更高版本。

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 3000
```

然后打开：`http://localhost:3000/`

## 交付前检查

```bash
npm ci
npm run audit:security
npm run lint
npx tsc --noEmit --incremental false
npm run test:deep-research
npm run test:search
npm run test:memory
node --test scripts/test-legacy-links.mjs
npm run build
```

安全检查覆盖完整依赖树，而不只检查 `dependencies`：Vinext 和 React Server Components 虽列在 `devDependencies`，也会进入正式构建。CI 在构建镜像前独立执行一次完整审计；高危或严重漏洞、审计不可用都会阻断后续构建。Dockerfile 不再重复审计，手动发布也须先执行上述审计命令。

2026-09-03 的安全更新统一升级了 Next.js、React/RSC、Vite 与 Vinext。`package.json` 中的 `overrides` 将旧上游锁定的 PostCSS、Sharp、ws、Undici 和 esbuild 指向修复版本，避免重新安装时带回已知漏洞。升级这些上游依赖时应重新审视约束，并验证本地构建及 Linux 正式容器；不要使用 `npm audit fix --force` 直接改写依赖树。

## 主要文件

- `app/page.tsx`：产品官网首页，负责说明 DSHEval 是什么、如何评测以及与 Top100 的关系。
- `app/results/page.tsx`：公开评测结果中心。
- `app/results/memory/2026-08-28/page.tsx`：首个记忆能力评测结果详情。
- `app/results/deep-research/2026-09-04/page.tsx`：Deep Research V12 逐题状态、基线增量、资源用量和方法说明。
- `app/data/deep-research.ts`：从已审核 V12 数据提取精简展示字段，完整账本不传入客户端。
- `public/eval-data/deep-research/v12/`：与 `evals/deep-research/results/v12/` 保持逐字节一致的五份下载文件；Deep Research 测试会检查同步状态。
- `app/methodology/memory/page.tsx`：记忆能力评测协议与证据要求。
- `app/components/ProductHero.tsx`：首页产品定义和证据链主视觉。
- `app/components/SiteChrome.tsx`：公共页头、页脚与品牌导航。
- `public/site-chrome.css`：与 Top100 的 `web/public/site-chrome.css` 保持逐字节一致的全站外壳样式。统一单层固定页头、移动菜单和浅色页脚；两仓库同时更新，无跨服务运行时依赖。
- `app/components/EvaluationEvidence.tsx`：可展开的评测证据和分级说明。
- `app/globals.css`：全站视觉样式和响应式布局。
- `app/layout.tsx`：页面标题、SEO、Open Graph 和分享图配置。
- `app/sitemap.ts`：生成 `/sitemap.xml`。
- `public/og.png`：社交平台分享预览图。
- `app/components/MemoryBenchmark.tsx`：记忆插件双轨协议、排名和过程指标。
- `public/eval-data/memory/`：评测运行器导出的脱敏榜单快照。
- `evals/memory/`：可独立执行的记忆评测代码、题集、协议、评分与单测。

## 生产配置

正式发布遵循 [生产发布约定](./docs/deployment.md)：PR 检查通过并合并 `main` 后，服务器从 Git 拉取；主机配置独立放在 `/opt/dsh-eval-state`。GitHub CI 只验证，不自动部署。不要直接发布未合并分支或上传源码包替换正式工作目录。

1. 目标部署地址为 `https://dsheval.ai/`，`next.config.ts` 不再设置 `basePath`。这次迁移须与 Top100 和网关一起切换，详见生产发布约定。
2. 首页与公共导航的 Top100 入口使用站内 `/top100/`；Top100 是 DSH-Eval 旗下的插件与 Skills 发现栏目。
3. 首页可切换 Memory 与 Deep Research 两份摘要；结果中心保留两项评测，各有独立详情页、评测协议和公开下载。
4. 各公开页面已经配置独立标题、描述、canonical 和结构化数据。
5. 本应用提供根域 `/robots.txt` 与 `/sitemap.xml`，robots 同时列出 `/top100/sitemap.xml`。评测下载使用 `/eval-data/`，Top100 插件的 `/data/` 接口保持兼容。
6. `public/legacy-top100.js` 兼容旧根路径榜单参数与片段链接；`deploy/Caddyfile` 处理旧路径和域名迁移。单独的 Sites 预览只包含评测应用；完整 Top100 分流必须使用统一网关。

## 包内未包含

- `node_modules`
- 构建产物与本机缓存
- `.env`、密钥或服务器凭据
- 逐题原始回答、DSH 会话、插件数据库与本机运行日志
