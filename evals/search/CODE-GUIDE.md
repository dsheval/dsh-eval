# 搜索插件测评代码导读

这份文档写给第一次打开本目录的人。它回答四个问题：这套代码要比较什么、一次任务怎样流转、每个文件负责什么，以及怎样在不误启动正式测评的前提下检查代码。

## 一句话理解

同一道冻结题目会在相同的 DSH 模型和 search-only 环境中，分别交给原生搜索基线 C0 与 8 个搜索插件 S1—S8。程序记录真实工具调用、来源 URL、回答与 Judge 结果，再逐题和 C0 做配对比较。

它不是一个“让模型自己给自己打总分”的脚本。确定性规则先判断是否真的检索、是否拿到可审计 URL、工具是否工作；只有正常完成的回答才进入 URL 检查和证据质量 Judge。安装失败、凭据缺失、Host 异常和超时均单独记账，不伪装成插件质量零分。

## 从哪里开始读

推荐按下面顺序阅读：

1. `README.md`：了解题目、条件、基线和评分口径。
2. `benchmark.md`：了解为什么这样比较，以及哪些结果允许进入排名。
3. `fixtures/suite.json` 与 `fixtures/catalog.json`：查看冻结实验参数和 8 个插件版本。
4. `src/runner.mjs`：看一次完整批次怎样编排。
5. `src/host.mjs`、`src/profile.mjs`：看超时、取消、进程和隔离边界。
6. `src/observe.mjs`、`src/score.mjs`、`src/judge.mjs`：看过程如何变成可比较结果。
7. `test/`：用测试用例确认代码声称的保护是否真的存在。

## 一次正式批次怎样流转

```text
读取并校验冻结配置
        |
        v
检查批次标签、模型标签、凭据与干净的基础 DSH_HOME
        |
        v
C0 首轮（12 题）
        |
        v
S1—S8 随机但可复现地排序（每个插件 12 题）
        |
        v
C0 尾轮（12 题）
        |
        v
检查 C0 前后漂移，并逐题生成插件相对 C0 的 WIN/TIE/LOSS
        |
        v
仅在记录完整、基线稳定、无系统错误时标记批次可发布
```

每一道题内部又是一个完全独立的小生命周期：

```text
创建隔离 DSH_HOME 与题目 workspace
  -> 安装/启用该条件需要的冻结插件
  -> 启动一个新的 DSH Host
  -> 创建一个新的 session
  -> 原题逐字发送
  -> 监控 step、工具调用、禁用工具和墙钟时间
  -> 正常回答：整理过程记录 -> 检查 URL -> Judge -> 评分
  -> 异常回答：取消 session -> 保存诊断 -> 记 SYSTEM_ERROR
  -> 无论成功或失败都停止本题 Host
  -> 原子化写入记录
```

因此，上一题超时的 session 或 Host 不会和下一题并行，也不能继续消耗额度或污染下一题历史。

## 文件树

```text
docs/search-eval/
|-- .gitignore
|-- README.md
|-- CODE-GUIDE.md
|-- benchmark.md
|-- DEVELOPMENT.md
|-- package.json
|-- fixtures/
|   |-- catalog.json
|   |-- suite.json
|   `-- deepresearch-bench-hard12.jsonl
|-- src/
|   |-- config.mjs
|   |-- host.mjs
|   |-- judge.mjs
|   |-- lib.mjs
|   |-- observe.mjs
|   |-- plugin.mjs
|   |-- profile.mjs
|   |-- report.mjs
|   |-- run.mjs
|   |-- runner.mjs
|   |-- score.mjs
|   `-- url-check.mjs
|-- test/
|   |-- baseline.test.mjs
|   |-- config.test.mjs
|   |-- host.test.mjs
|   |-- observe.test.mjs
|   |-- plugin.test.mjs
|   |-- profile.test.mjs
|   |-- report.test.mjs
|   |-- runner.test.mjs
|   |-- safety.test.mjs
|   `-- score.test.mjs
`-- records/                 # 运行时生成，已被 Git 忽略
```

## 根目录文件的作用

- `.gitignore`：忽略正式运行产生的 `records/` 和本机私有配置 `*.local.json`，避免把回答、环境信息或本机路径提交到仓库。
- `README.md`：测评入口文档，说明 12 道题的真实来源、8 个插件、C0/C1 基线、120 次正式条件任务和评分输出。
- `CODE-GUIDE.md`：当前文件，帮助人理解代码结构和执行边界。
- `benchmark.md`：实验规范。定义公平性、credential lane、确定性门槛、配对比较和方法依据。
- `DEVELOPMENT.md`：操作者手册。列出安全命令、正式运行前的环境要求、双重执行锁、Ctrl+C 行为和输出位置。
- `package.json`：只声明 Node 版本与命令入口，不引入第三方 npm 运行依赖。

## fixtures：冻结的实验输入

- `fixtures/deepresearch-bench-hard12.jsonl`：12 道原始任务。它是从 DeepResearch Bench 冻结出的困难子集，不是本项目生成题；哈希、任务 ID、顺序和中英文数量都会校验。
- `fixtures/suite.json`：实验总开关。包含题集哈希、Host 隔离方式、30 分钟单题墙钟、24 step/48 tool call 预算、禁用工具、Judge 配置和发布门槛。
- `fixtures/catalog.json`：条件名录。冻结 C0、可选 C1、S1—S8 的包版本或 Git commit、安装方式、所需凭据和默认 provider。

修改这三个文件中的任何比较关键字段，通常都会改变 `comparisonKey`；新结果不能和旧 C0 混用。

## src：正式实现

- `src/run.mjs`：命令行入口。解析 `validate`、`plan`、`preflight`、`run`、`report`，并把 Ctrl+C/SIGTERM 转成可回收的中止信号。
- `src/config.mjs`：加载和校验 suite/catalog/任务文件，选择条件，生成运行计划与 `comparisonKey`。这里负责在启动 DSH 之前拒绝错误题数、错误哈希、重复 ID 或不合法预算。
- `src/runner.mjs`：总编排器。安排 C0 首轮、插件顺序和 C0 尾轮；逐条件安装、逐题启动 Host、落盘记录；最后检查覆盖率、批次时长与基线漂移。
- `src/profile.mjs`：隔离环境构建器。为每个条件准备独立 `DSH_HOME`，只复制允许的凭据引用，生成统一的 `search-eval` preset，并给每题创建独立 workspace。
- `src/plugin.mjs`：插件 admission 与安装。支持无需安装、冻结的 `dsh add` 和本地 source-link 三类方式；会核验所需凭据、平台、源码路径和 Git commit，并对命令输出做密钥遮盖。
- `src/host.mjs`：DSH Host 与 session 控制层。负责启动/停止进程、RPC、等待空闲、严格墙钟超时、step/tool call 预算、禁用工具检测、`session.cancel` 和端口关闭确认。
- `src/observe.mjs`：把原始 DSH history 折叠成可审计的过程 ledger。识别搜索/抓取工具、查询、provider、结构化结果、URL、错误、超时和显式回退。
- `src/url-check.mjs`：检查回答和检索结果中的 HTTP(S) URL 是否可打开。它拒绝 localhost、私网、链路本地地址与跳转到私网的请求，避免测评器被 URL 引导访问本机服务。
- `src/judge.mjs`：为证据质量生成盲评提示，并调用 DeepSeek-compatible Judge。它校验结构化返回；Judge 不可用时记独立故障，不用臆测分数。
- `src/score.mjs`：应用确定性门槛并生成任务状态，派生指标向量，再将插件记录和对应的两个 C0 bracket 均值比较为 `WIN/TIE/LOSS`。
- `src/report.mjs`：扫描 `records/`，按 batch 和 `comparisonKey` 聚合。即使某条件 admission 失败、没有题目记录，也会通过 `meta.json` 出现在报告中。
- `src/lib.mjs`：无业务倾向的公共函数，包括 JSON/JSONL 读写、哈希、URL/域名提取、均值、稳定序列化、run ID、错误规范化和密钥遮盖。

## test：保护行为的证据

- `test/config.test.mjs`：验证 Hard-12 哈希、ID、语言分布、来源元数据、配置错误检测和计划生成。
- `test/baseline.test.mjs`：验证 C0 首尾 bracket 的聚合、漂移判断和不可比较条件。
- `test/host.test.mjs`：用假的 Host/RPC 测试正常 turn、严格超时、取消、step/tool 预算和禁用工具，不启动真实 DSH。
- `test/observe.test.mjs`：验证工具历史能正确变成检索次数、URL、provider、错误、超时和回退记录。
- `test/plugin.test.mjs`：验证插件预检、凭据缺失、source-link 路径与冻结 commit 检查。
- `test/profile.test.mjs`：验证隔离 DSH_HOME、凭据最小复制、search-only preset 和 workspace 安全边界。
- `test/runner.test.mjs`：验证双重执行锁、正式预检、任务生命周期、系统错误处理、覆盖率与批次可发布条件。
- `test/safety.test.mjs`：验证安全命令不会安装插件或启动 DSH，并检查危险配置会被拒绝。
- `test/score.test.mjs`：验证 `PASS/PARTIAL/FAIL/RETRIEVAL_FAIL/SYSTEM_ERROR` 与配对胜负的规则。
- `test/report.test.mjs`：验证报告按 batch/comparison key 分组，并保留无题目输出的失败条件。

## 哪些命令可以安全运行

在 `docs/search-eval` 中：

```powershell
npm test
npm run validate
npm run plan
npm run preflight
npm run report
```

这些命令不会启动 DSH，不会安装插件，不会运行 12 道任务，也不会调用搜索或 Judge。`preflight` 只检查本机条件是否具备。

真正执行测评必须同时满足两个锁：命令行带 `--execute`，并设置值完全匹配的确认环境变量。执行方法只保留在 `DEVELOPMENT.md`，避免阅读或生成代码时误跑。

## 看结果时最容易误解的地方

- 12 道题不是 12 次总运行。正式默认计划是 `12 × (8 个插件 + 2 个 C0 bracket) = 120` 个条件任务。
- C0 首尾各跑一次不是重复刷分，而是检测长批次中网络、模型或搜索环境漂移；插件逐题对比使用两次 C0 的均值。
- C1 是诊断闭卷回答倾向的可选条件，不参加插件排名。
- `SYSTEM_ERROR` 表示测评基础设施没有提供有效质量样本，不能当作插件答错，也不能用来凑满 12 条可排名记录。
- 调用更多搜索工具不自动得高分。工具次数和延迟是成本；核心仍是可审计来源、引用正确性、完整性和关键主张支持度。
- `records/` 是运行产物而不是源码。需要分享结果时，应先确认没有敏感环境信息，再使用单独的结果发布流程。
