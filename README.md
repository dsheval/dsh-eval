# DSH Eval

DSH 插件生态的独立评测与推荐项目：同一仓库保存评测运行器、公开数据快照与展示前端。

- 线上地址：[https://dsheval.ai/dsheval](https://dsheval.ai/dsheval)
- 本地开发：`npm run dev`，访问 `http://localhost:3000/dsheval`
- 生产构建：`npm run build`
- 记忆评测：[`evals/memory`](./evals/memory)
- 记忆评测单测：`npm run test:memory`

## 仓库结构

- `app/`：DSH Eval 网站与真实榜单展示。
- `evals/memory/`：记忆插件双轨评测运行器、LoCoMo 题集、协议、评分和测试。
- `public/data/memory/`：从本地完整记录生成的脱敏公开快照；不包含逐题回答、本机路径或会话原文。

评测运行时产生的工作区、插件数据库、逐题回答和任务日志不会提交。完成一轮评测后，使用 `evals/memory` 的 `export:site` 命令刷新公开快照。

生产部署使用独立 Docker 容器，应用原生使用 `/dsheval` base path，不依赖 `dsh-top100` 的代码、依赖或运行环境。

更多开发说明见 [README_FOR_DEVELOPER.md](./README_FOR_DEVELOPER.md)。
