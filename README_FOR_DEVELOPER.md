# DSH Eval Homepage Frontend

这是 DSH Eval 官网主页的独立前端交付包，不包含现有 `dsh-top100` 项目代码，也不包含后端或正式评测 API。

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
npm run build
```

## 主要文件

- `app/page.tsx`：官网主体结构、Top100 入口和评测方法内容。
- `app/components/RecommendationDemo.tsx`：首页推荐报告交互演示。
- `app/globals.css`：全站视觉样式和响应式布局。
- `app/layout.tsx`：页面标题、SEO、Open Graph 和分享图配置。
- `public/og.png`：社交平台分享预览图。

## 生产配置

1. 应用部署在 `https://dsheval.ai/dsheval`，`next.config.ts` 中的 `basePath` 已设为 `/dsheval`。
2. `app/page.tsx` 中的 `TOP100_URL` 指向现有线上 `https://dsheval.ai/`。
3. 首页中的推荐结果和榜单内容均为产品结构演示数据，不是正式评测结论。接入真实接口时请保留“证据不足，暂不推荐”的状态。
4. `app/layout.tsx` 的 canonical 和分享元数据按生产地址配置。

## 包内未包含

- `node_modules`
- 构建产物与本机缓存
- `.env`、密钥或服务器凭据
- `dsh-top100` 源码
