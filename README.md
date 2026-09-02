# DSH Eval

DSH Eval 是 DSH 插件生态的独立评测与展示项目。仓库同时包含：

- 可部署的网站前端；
- DSH Deep Research 插件的隔离评测运行器；
- DSH 搜索插件 Hard-12 隔离测评运行器；
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
npm run test:deep-research
npm run test:search
npm run test:memory
npm run build
```

Deep Research 评测的只读入口：

```bash
npm run eval:deep-research -- validate
npm run eval:deep-research -- plan
```

`validate`、`plan` 和单元测试不会启动 DSH 或调用模型。正式 `run` 另有命令参数与环境变量双重锁，详见 [`evals/deep-research/DEVELOPMENT.md`](./evals/deep-research/DEVELOPMENT.md)。

搜索插件测评的只读入口：

```bash
npm run eval:search -- validate
npm run eval:search -- plan
```

这两个命令及 `npm run test:search` 不会启动 DSH、安装插件或调用搜索服务。完整代码导读、文件树和运行安全边界见 [`evals/search/CODE-GUIDE.md`](./evals/search/CODE-GUIDE.md)。

记忆评测入口：

```bash
npm run eval:memory -- --help
```

运行第三方插件前必须使用低权限容器或独立系统账户，并准备只用于本轮、可随时撤销的 DSH 凭据文件：

```bash
export DSH_EVAL_ISOLATED=1
export DSH_EVAL_CREDENTIALS_FILE=/secure/path/short-lived.credentials.yaml
npm run eval:memory -- suite --plugins dsh-mnemon --fresh
```

PowerShell 使用 `$env:DSH_EVAL_ISOLATED = '1'` 和 `$env:DSH_EVAL_CREDENTIALS_FILE = 'D:\secure\short-lived.credentials.yaml'`。未满足这两个安全前置条件时，第三方插件会被记录为安装失败；C0 原生基线不受影响。

评测完成后生成网站使用的脱敏快照：

```bash
npm --prefix evals/memory run export:site -- --day YYYY-MM-DD
```

## 评测模型

记忆插件使用同一批 LoCoMo 问题分别进入两个轨道，轨道内比较，不把两种交互方式混成一个分数：

- `passive`：题面不提示模型调用记忆工具，衡量插件的零提示自动记忆与自动召回能力；
- `guided`：使用统一、与答案无关的引导语要求模型保存或检索持久记忆，衡量工具型插件在获得公平调用机会后的能力。

基线 C0 是不安装第三方记忆插件的原生 DSH。每题经过埋点、优雅关闭旧 Host、冷启动、创建新会话、追问、评分与过程指标采集。完整协议、评分和运行方式分别见 [`benchmark.md`](./evals/memory/benchmark.md)、[`DEVELOPMENT.md`](./evals/memory/DEVELOPMENT.md) 和 [`evals/memory/README.md`](./evals/memory/README.md)。

Deep Research 评测同样以不安装插件的 C0 为基线，每次只安装一个插件。当前 V12 紧凑题集由 4 个独立题面、5 个测评项组成，按 `2:2:1` 覆盖短事实、长文和产品诊断；分别记录研究过程账与结果账，不压成一个不可解释的加权总分。完整规则见 [`evals/deep-research/benchmark.md`](./evals/deep-research/benchmark.md)。

搜索插件使用 DeepResearch Bench 冻结 Hard-12，在完全相同的 search-only preset 中逐题比较 8 个插件与原生 C0。正式批次用 C0 首尾 bracket 检测环境漂移；工具过程、URL 可达性、证据 Judge 和系统故障分开记录，不压成一个不可解释的总分。完整规则见 [`evals/search/benchmark.md`](./evals/search/benchmark.md)。

## 完整文件树与职责

以下概览仓库主要文件；`node_modules/`、构建产物、本机缓存和评测原始记录不在其中。搜索测评子目录的逐文件树与职责见 [`evals/search/CODE-GUIDE.md`](./evals/search/CODE-GUIDE.md)。

```text
dsh-eval/
├── .dockerignore
│   └── 控制 Docker 构建上下文，排除依赖、缓存和本机文件。
├── .gitattributes
│   └── 强制 Deep Research 的 WSL shell 脚本使用 LF，避免 Windows 换行导致执行失败。
├── .gitignore
│   └── 忽略依赖、构建产物、环境变量和本地运行文件。
├── .openai/
│   └── hosting.json
│       └── OpenAI Sites 项目及部署入口配置。
├── app/
│   ├── components/
│   │   ├── MemoryBenchmark.tsx
│   │   │   └── 读取真实快照并展示 passive/guided 双轨排名、准确率、延迟、Token 与方法说明。
│   │   └── EvaluationDemo.tsx
│   │       └── 首页评测流程、证据与结果的交互演示组件。
│   ├── data/memory/
│   │   └── locomo20-2026-08-28.json
│   │       └── 构建期读取的脱敏 LoCoMo 20 双轨榜单快照。
│   ├── globals.css
│   │   └── 全站主题、排版、榜单图形、动画和响应式样式。
│   ├── layout.tsx
│   │   └── 根布局以及标题、canonical、Open Graph 等站点元数据。
│   └── page.tsx
│       └── 官网首页结构，组合介绍、评测演示和记忆评测区域。
├── deploy/
│   └── Caddyfile
│       └── 生产入口的 HTTPS、反向代理与路径转发配置。
├── docker/
│   └── nginx.conf
│       └── 容器内静态资源及 `/dsheval` 路径的 Nginx 配置。
├── evals/deep-research/
│   ├── fixtures/
│   │   ├── catalog.json
│   │   │   └── C0 与 P1–P8 的插件名录、安装方式、平台、凭证引用和准入约束。
│   │   ├── private-tasks.example.json
│   │   │   └── R1–R4 私有短事实题的本地配置模板，不含真实题面或答案。
│   │   ├── source-lock.json
│   │   │   └── 源码型插件与 DSH 的固定仓库、commit、归档名和 SHA-256。
│   │   └── suite.json
│   │       └── V12 的 4 个独立题面、5 个测评项及 Judge、预算、交付物和来源门槛配置。
│   ├── records/
│   │   ├── .gitignore
│   │   │   └── 忽略所有本地逐题记录和运行期榜单。
│   │   └── .gitkeep
│   │       └── 在没有本地结果时保留 records 目录。
│   ├── schema/
│   │   ├── catalog.schema.json
│   │   │   └── Deep Research 插件名录的数据结构与字段约束。
│   │   ├── record.schema.json
│   │   │   └── 单题过程账、结果账、环境和 Judge 信息的数据结构。
│   │   └── suite.schema.json
│   │       └── 题集、任务模式、来源、交付物和 Judge 配置的数据结构。
│   ├── scripts/
│   │   ├── admission-smoke.mjs
│   │   │   └── 对源码型目标做隔离 Profile 安装与组合配置冒烟检查。
│   │   ├── compose-v12-refresh.mjs
│   │   │   └── 将统一补跑的 R3 与已验证 V11 记录组合为带来源追踪的 V12 条件记录。
│   │   ├── generate-v12-html-report.mjs
│   │   │   └── 从本机脱敏汇总生成离线 HTML 可视化报告；产物保留在忽略的 records 目录。
│   │   ├── preflight-summary.mjs
│   │   │   └── 输出全部目标的只读准入预检摘要。
│   │   ├── prepare-wsl.sh
│   │   │   └── 在 WSL 准备固定 Node、pnpm、DSH、源码和 Docker 环境。
│   │   ├── research-eval-wsl.sh
│   │   │   └── 使用固定 WSL 运行时调用 Deep Research 评测 CLI。
│   │   ├── session-workspace-smoke.mjs
│   │   │   └── 检查题目会话是否绑定到隔离工作区而非评测源码目录。
│   │   └── validate-condition-run.mjs
│   │       └── 严格验证条件运行状态、五题可评分性、Judge 与组合来源追踪。
│   ├── src/
│   │   ├── artifacts.mjs
│   │   │   └── 在限定工作区内收集报告、表格等产物并阻止符号链接越界。
│   │   ├── config.mjs
│   │   │   └── 加载、合并、校验题集、名录和本地私有短事实题。
│   │   ├── host.mjs
│   │   │   └── 在隔离 DSH_HOME 中启停 Host、调用 RPC 并管理工作区会话。
│   │   ├── judge.mjs
│   │   │   └── 构建匿名固定提示并调用 OpenAI-compatible 长文 Judge。
│   │   ├── lib.mjs
│   │   │   └── 提供路径、JSON、哈希、文本归一化、URL 和空账本等通用能力。
│   │   ├── observe.mjs
│   │   │   └── 从 history 折叠计划、工具、来源、异常、恢复、资源和产物过程账。
│   │   ├── plugin.mjs
│   │   │   └── 对不同安装类型执行准入检查、源码边界校验和插件安装。
│   │   ├── profile.mjs
│   │   │   └── 为每个条件准备独立 DSH_HOME、Profile、凭据和任务工作区。
│   │   ├── report.mjs
│   │   │   └── 聚合本地记录并按门槛和字典序生成多指标榜单。
│   │   ├── run.mjs
│   │   │   └── 提供 validate、plan、run、report 命令及正式运行安全锁入口。
│   │   ├── runner.mjs
│   │   │   └── 编排预检、R1–R10 执行、中断恢复、评分、Judge 和记录落盘。
│   │   ├── score.mjs
│   │   │   └── 执行短事实、长文确定性检查、派生题和 C0 增量判定。
│   │   └── url-check.mjs
│   │       └── 安全检查引用 URL 的可达性，并阻止本机或私网地址访问。
│   ├── test/
│   │   ├── artifacts.test.mjs
│   │   │   └── 验证产物收集、目录限制和符号链接防越界行为。
│   │   ├── config.test.mjs
│   │   │   └── 覆盖私有题合并、严格校验、目标选择和计划生成。
│   │   ├── host.test.mjs
│   │   │   └── 覆盖 Host 生命周期、父子会话聚合、工具预算和无进展熔断。
│   │   ├── judge.test.mjs
│   │   │   └── 覆盖 Judge 提示、结构化结果和错误降级路径。
│   │   ├── observe.test.mjs
│   │   │   └── 覆盖 history 到研究步骤、工具、来源和产物过程账的折叠。
│   │   ├── plugin.test.mjs
│   │   │   └── 覆盖源码根目录解析、边界检查和目标准入逻辑。
│   │   ├── report.test.mjs
│   │   │   └── 验证结果聚合与多指标排序规则。
│   │   ├── safety.test.mjs
│   │   │   └── 验证双重执行锁和 Host 隔离启动目录。
│   │   ├── score.test.mjs
│   │   │   └── 覆盖事实、交付物、引用、风险、恢复和基线增量评分。
│   │   └── url-check.test.mjs
│   │       └── 覆盖 URL 协议、私网阻断与安全失败结果。
│   ├── benchmark.md
│   │   └── Deep Research V12 的对象、紧凑题集、双账、评分和榜单规则。
│   ├── DEVELOPMENT.md
│   │   └── 架构、执行锁、凭证、WSL 准入、私有题和正式运行说明。
│   ├── package.json
│   │   └── Deep Research 子包元数据及校验、计划、运行、报告和测试命令。
│   └── README.md
│       └── Deep Research 评测定位、安全边界、文件结构和只读命令入口。
├── evals/search/
│   ├── fixtures/
│   │   └── 冻结 Hard-12、C0/C1 和 S1–S8 插件名录及执行参数。
│   ├── src/
│   │   └── 配置、隔离 Profile、插件安装、Host、观测、Judge、评分、编排与报告实现。
│   ├── test/
│   │   └── 覆盖题集哈希、执行锁、超时取消、隔离、观测、评分和报告的本地单元测试。
│   ├── CODE-GUIDE.md
│   │   └── 搜索测评完整文件树、逐文件职责、生命周期和安全命令导读。
│   ├── benchmark.md
│   │   └── Hard-12、公平性、C0 bracket、证据门槛和配对比较规范。
│   ├── DEVELOPMENT.md
│   │   └── 只读命令、正式运行双重锁、中止回收与输出说明。
│   ├── package.json
│   │   └── 搜索测评的校验、计划、预检、执行、报告与测试命令。
│   └── README.md
│       └── 题目来源、八插件条件、基线、隔离和评分入口。
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

- `evals/deep-research/fixtures/private-tasks.local.json`、`evals/deep-research/records/` 和 `.research-eval-deps/` 只保存在本机，不提交 Git；示例模板不含真实题面或答案。
- `evals/search/records/`、隔离 DSH_HOME、逐题回答和 Judge 结果只保存在本机，不提交 Git。
- `evals/memory/records/`、`~/.dsh/memory-eval-workspaces/`、插件数据库和 DSH 会话均为本机运行数据，不提交 Git。
- `app/data/memory/` 与 `public/data/memory/` 只保存经 `export-site.mjs` 裁剪后的公开指标，不包含标准答案、逐题回答、会话 ID、本机路径或原始会话。
- 第三方插件会执行代码。正式评测应在隔离、低权限、仅带专用短期凭据的环境运行，不能把个人开发机或长期密钥当作安全边界。
- DSH 子进程只继承运行所需的最小环境变量；插件 API Key 只有在名录的 `requiredEnv` 中明确声明时才会传入。
- 远端排行榜只用于从本地审核名录中选择和排序插件，不能提供安装命令；所有执行源都必须固定版本并通过 SHA-256 或 SRI 校验。

## 部署

生产站点使用 `/dsheval` base path。传统容器部署使用 `Dockerfile`、`compose.production.yml`、Caddy 与 Nginx 配置；OpenAI Sites 部署由 `.openai/hosting.json` 和 `vite.config.ts` 管理。

更具体的前端交付信息见 [`README_FOR_DEVELOPER.md`](./README_FOR_DEVELOPER.md)。
