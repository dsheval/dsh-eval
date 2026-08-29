# DSH Eval

DSH Eval 是 DSH 插件生态的独立评测与展示项目。仓库同时包含：

- 可部署的网站前端；
- DSH 记忆插件双轨评测运行器；
- LoCoMo 20 题评测配置、插件名录、评分逻辑与自动化测试；
- 从本地完整测评记录导出的脱敏公开榜单快照。

线上地址：[https://dsheval.ai/dsheval](https://dsheval.ai/dsheval)

## 快速开始

环境要求：Node.js 22.13 或更高版本。

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 3000
```

浏览器访问 `http://localhost:3000/dsheval`。交付前运行：

```bash
npm run lint
npm run test:memory
npm run build
```

记忆评测入口：

```bash
npm run eval:memory -- --help
```

评测完成后生成网站使用的脱敏快照：

```bash
npm --prefix evals/memory run export:site -- --day YYYY-MM-DD
```

## 评测模型

记忆插件使用同一批 LoCoMo 问题分别进入两个轨道，轨道内比较，不把两种交互方式混成一个分数：

- `passive`：题面不提示模型调用记忆工具，衡量插件的零提示自动记忆与自动召回能力；
- `guided`：使用统一、与答案无关的引导语要求模型保存或检索持久记忆，衡量工具型插件在获得公平调用机会后的能力。

基线 C0 是不安装第三方记忆插件的原生 DSH。每题经过埋点、优雅关闭旧 Host、冷启动、创建新会话、追问、评分与过程指标采集。完整协议、评分和运行方式分别见 [`benchmark.md`](./evals/memory/benchmark.md)、[`DEVELOPMENT.md`](./evals/memory/DEVELOPMENT.md) 和 [`evals/memory/README.md`](./evals/memory/README.md)。

## 完整文件树与职责

以下列出仓库内全部受版本控制的项目文件；`node_modules/`、构建产物、本机缓存和评测原始记录不在其中。

```text
dsh-eval/
├── .dockerignore
│   └── 控制 Docker 构建上下文，排除依赖、缓存和本机文件。
├── .gitignore
│   └── 忽略依赖、构建产物、环境变量和本地运行文件。
├── .openai/
│   └── hosting.json
│       └── OpenAI Sites 项目及部署入口配置。
├── app/
│   ├── components/
│   │   ├── MemoryBenchmark.tsx
│   │   │   └── 读取真实快照并展示 passive/guided 双轨排名、准确率、延迟、Token 与方法说明。
│   │   └── RecommendationDemo.tsx
│   │       └── 首页插件推荐报告的交互演示组件。
│   ├── data/memory/
│   │   └── locomo20-2026-08-28.json
│   │       └── 构建期读取的脱敏 LoCoMo 20 双轨榜单快照。
│   ├── globals.css
│   │   └── 全站主题、排版、榜单图形、动画和响应式样式。
│   ├── layout.tsx
│   │   └── 根布局以及标题、canonical、Open Graph 等站点元数据。
│   └── page.tsx
│       └── 官网首页结构，组合介绍、推荐演示和记忆评测区域。
├── deploy/
│   └── Caddyfile
│       └── 生产入口的 HTTPS、反向代理与路径转发配置。
├── docker/
│   └── nginx.conf
│       └── 容器内静态资源及 `/dsheval` 路径的 Nginx 配置。
├── evals/memory/
│   ├── fixtures/
│   │   ├── patches/
│   │   │   ├── causal-memory-isolated.patch.yml
│   │   │   │   └── Causal Memory 的隔离目录、非交互运行与兼容性补丁定义。
│   │   │   ├── dsh-memento-guided.patch.yml
│   │   │   │   └── DSH Memento 在 guided 轨道所需的最小配置补丁。
│   │   │   ├── dsh-noema-isolated.patch.yml
│   │   │   │   └── DSH Noema 的独立数据目录与评测隔离补丁。
│   │   │   └── mnemon-isolated.patch.yml
│   │   │       └── Mnemon 的独立存储、启动参数与评测兼容补丁。
│   │   ├── catalog.json
│   │   │   └── 完整插件名录：安装项、协议、必需环境变量、清理边界和补丁。
│   │   ├── locomo20.json
│   │   │   └── 第二版 LoCoMo 20 题题面、埋点材料、标准答案和评分信息。
│   │   ├── native-catalog.json
│   │   │   └── 仅运行原生 DSH 基线时使用的精简名录。
│   │   ├── native-vs-causal-catalog.json
│   │   │   └── 原生 DSH 与 Causal Memory 定向对照运行名录。
│   │   └── suite.json
│   │       └── 第一版八题套件及对应 seed/probe 操作定义。
│   ├── records/
│   │   ├── .gitignore
│   │   │   └── 忽略逐题回答、会话过程和运行期榜单，避免敏感数据入库。
│   │   └── .gitkeep
│   │       └── 在没有本地记录时保留 records 目录。
│   ├── schema/
│   │   ├── catalog.schema.json
│   │   │   └── 插件名录 JSON 的字段、类型和约束定义。
│   │   └── record.schema.json
│   │       └── 单题评测记录、评分及观测指标的数据结构定义。
│   ├── src/
│   │   ├── catalog.mjs
│   │   │   └── 读取、校验和筛选插件名录，并解析全榜记忆插件目标。
│   │   ├── eval-lifecycle-plugin.mjs
│   │   │   └── 评测专用生命周期插件，用于触发 DSH Host 原生优雅关闭。
│   │   ├── export-site.mjs
│   │   │   └── 将本地完整结果裁剪成不含答案、会话和本机路径的公开快照。
│   │   ├── host.mjs
│   │   │   └── 启停 DSH Host、调用 RPC、管理会话并提取助手回答。
│   │   ├── leaderboard.mjs
│   │   │   └── 聚合逐题记录，计算准确率、耗时、Token 和轨道排名。
│   │   ├── lib.mjs
│   │   │   └── 通用文件读写、题集装载、提示构造、评分和空记录生成。
│   │   ├── observe.mjs
│   │   │   └── 只读解析 history 事件，统计 Token、工具调用、记忆注入和灌窗过程。
│   │   ├── plugin-ops.mjs
│   │   │   └── 安装/卸载单个插件，并严格按名录定义清理插件数据。
│   │   ├── profile.mjs
│   │   │   └── 创建独立 memory-eval profile，准备 Web bundle、凭据和生命周期补丁。
│   │   ├── progress.mjs
│   │   │   └── 管理逐题原子落盘、断点续跑、后台 job 和状态查询。
│   │   ├── protocol.mjs
│   │   │   └── 选择 passive/guided 协议，生成统一引导语并应用协议配置。
│   │   ├── run.mjs
│   │   │   └── 评测 CLI 入口，提供 new、prompt、score、summary、status 和 suite 命令。
│   │   ├── suite-runner.mjs
│   │   │   └── 核心编排器，逐目标执行安装、埋点、冷启动、追问、观测、评分和汇总。
│   │   └── workspace-reset.mjs
│   │       └── 在限定评测根目录内安全重建甲/乙工作区并写入隔离标记。
│   ├── test/
│   │   ├── fixtures/
│   │   │   └── rankings-sample.json
│   │   │       └── 测试从总榜筛选记忆插件时使用的固定样例。
│   │   ├── catalog.test.mjs
│   │   │   └── 覆盖名录解析、C0 规则、目标筛选和 all-memory 行为。
│   │   ├── export-site.test.mjs
│   │   │   └── 验证公开快照字段完整且不会泄漏答案、会话 ID 或本机路径。
│   │   ├── host.test.mjs
│   │   │   └── 覆盖 RPC 信封、Host 环回通信、回答抽取和进程控制辅助逻辑。
│   │   ├── observe.test.mjs
│   │   │   └── 覆盖 history 事件折算、工具调用、注入与灌窗统计。
│   │   ├── profile.test.mjs
│   │   │   └── 验证评测 profile 初始化、配置复制及生命周期插件准备。
│   │   ├── progress.test.mjs
│   │   │   └── 覆盖运行状态、断点续跑、原子记录与后台 job 元数据。
│   │   ├── protocol.test.mjs
│   │   │   └── 覆盖轨道匹配、统一引导语和协议补丁选择。
│   │   ├── runner.test.mjs
│   │   │   └── 覆盖编排计划、失败判定、清理边界和 dry-run 行为。
│   │   ├── score.test.mjs
│   │   │   └── 覆盖第一版及 LoCoMo 题目的答案归一化和正确性评分。
│   │   └── workspace-reset.test.mjs
│   │       └── 验证工作区重建只发生在允许目录且不会越界删除。
│   ├── benchmark.md
│   │   └── 评测规则、基线、双轨定义、题目与计分标准原文。
│   ├── DEVELOPMENT.md
│   │   └── 自动化架构、命令参数、运行目录、故障处理和开发交接说明。
│   ├── FIRST-ROUND-RESULTS.md
│   │   └── 第一轮实验数据、已知协议错配及第二版改进依据。
│   ├── package.json
│   │   └── 记忆评测子包元数据及 start、test、export:site 脚本。
│   └── README.md
│       └── 记忆评测快速入口、目录职责、手工/自动运行和结果导出说明。
├── public/
│   ├── data/memory/
│   │   └── locomo20-2026-08-28.json
│   │       └── 可供浏览器下载的脱敏榜单快照，与 app/data 的构建副本同步。
│   ├── favicon.svg
│   │   └── 网站浏览器图标。
│   └── og.png
│       └── 社交平台链接分享预览图。
├── compose.production.yml
│   └── 生产容器、端口、重启和代理网络的 Docker Compose 编排。
├── Dockerfile
│   └── 安装依赖、构建前端并生成生产运行镜像。
├── eslint.config.mjs
│   └── TypeScript、React 和 Next/Vinext 的 ESLint 规则入口。
├── next.config.ts
│   └── Next 兼容配置，包括 `/dsheval` basePath 和静态资源前缀。
├── package-lock.json
│   └── 锁定根项目全部 npm 依赖版本与完整性信息，确保可复现安装。
├── package.json
│   └── 根项目依赖、Node 版本和开发/构建/评测脚本入口。
├── README_FOR_DEVELOPER.md
│   └── 前端本地运行、交付检查、生产路径和仓库边界说明。
├── README.md
│   └── 本文件：项目入口、双轨概念、完整文件树及安全边界。
├── tsconfig.json
│   └── TypeScript 编译目标、路径别名、JSX 和严格类型检查设置。
└── vite.config.ts
    └── Vinext/Vite、React RSC、Cloudflare 与 OpenAI Sites 构建插件配置。
```

## 数据边界

- `evals/memory/records/`、`~/.dsh/memory-eval-workspaces/`、插件数据库和 DSH 会话均为本机运行数据，不提交 Git。
- `app/data/memory/` 与 `public/data/memory/` 只保存经 `export-site.mjs` 裁剪后的公开指标，不包含标准答案、逐题回答、会话 ID、本机路径或原始会话。
- 第三方插件会执行代码。正式评测应在隔离、低权限、仅带专用短期凭据的环境运行，不能把个人开发机或长期密钥当作安全边界。

## 部署

生产站点使用 `/dsheval` base path。传统容器部署使用 `Dockerfile`、`compose.production.yml`、Caddy 与 Nginx 配置；OpenAI Sites 部署由 `.openai/hosting.json` 和 `vite.config.ts` 管理。

更具体的前端交付信息见 [`README_FOR_DEVELOPER.md`](./README_FOR_DEVELOPER.md)。
