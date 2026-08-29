# 开发说明

评测套件，不是记忆插件。题集固定；**插件名单和交互协议都是输入，不写死在流程里。** 多一个记忆插件 = 名录多一行并声明 `defaultProtocol`，编排器再走：装一个 → 按匹配协议跑 T1–T8 → 卸掉清库 → 下一个。

手工记分入口仍是 [README.md](./README.md)。下面只写自动化这一批。

## 现状

已完成：基准、题集、名录、主账记分、Host 驱动、独立 `memory-eval` profile、装卸/wipe、过程账观察器、`suite` 编排、单测。

第一批名录是 C0 + 总榜记忆向 Top8（P1–P8），只是默认子集。加插件只改 `fixtures/catalog.json`。

本机 C0×T1 已用 `--detach` 对着真 DSH 开跑（`memory-eval` :3180）。多数插件的 wipe 路径还空着，空着就不会盲删。

长等模型时不要把 `suite` 挂在 Cursor 对话前台：用 `--detach` 后台跑，进度写在 `records/<runId>/progress.json` 和 `run.log`。对话断了也不丢题，`status` 看进度，再跑同一轮会跳过已打分的题。`--fresh` 才重开。

## 自动化怎么设计（屏障与评分相同，交互协议匹配插件）

三块数据分开，流程不认「这是第几个热门插件」：

| 块 | 装什么 | 以后加插件改哪里 |
| --- | --- | --- |
| 题集 | T1–T8 埋点、追问、过线 | 一般不改 |
| 名录 | 每个插件一行：id、安装命令、wipe 路径、Key/审批、默认协议和最小配置补丁 | **只加这一行** |
| 驱动 | 和网页同一条：`session.create` / `prompt` / `history`，T5 换 workspace，T8 杀进程 | 不改 |

编排器固定相同题面、屏障、评分与观察方式，但先按名录选择交互协议：

- `passive`：埋点和追问保持原题面，测零提示自动抽取、自动召回。
- `guided`：埋点附加“使用已安装的持久记忆能力”，追问附加“先使用已安装的持久记忆检索”；不泄露工具名和答案。
- `session-reference`：只给原生 DSH 显式会话引用实验使用。

`matched` 是默认选择器，不是第四种协议。它按插件的 `defaultProtocol` 选轨，并为实际出现的每种协议各跑一个同协议 C0。排行、过程增量和基线查找都要求协议相同。

之后对每个目标做同一件事：

1. 准入：先停 Host，再 `dsh plugin add`，再启动评测 profile。失败只记「装不上」，不打质量分。
2. 逐题：会话 A 发 `suite` 里的埋点 → 屏障（优雅关闭并冷启动 / 换工作区 / 强制杀 DSH）→ 会话 B 发追问 → 取最后一条助手文本 → `scoreAnswer`。
3. 收尾：停 Host，卸插件，按该行的 wipe 表清数据。未知路径不盲删，记「未清干净」。
4. 下一个。一次只装一个。C0 必须先跑；跨会话还全对就停。

可执行名录只来自本地审核过的 `catalog.json`。`suite --all-memory` 会用远端总榜发现和排序记忆向条目（排除 skill，排除 `dsh-context` 等窗口插件），但只保留能与本地名录精确匹配的目标；远端 `install.commands` 永远不会转成执行命令。新插件必须先核对官方交互面、固定 commit/精确包版本、记录完整性摘要，并补齐 `defaultProtocol` 后才能进入评测。P3/P5 用名录上的 `conflictsWith` 声明，不要写进驱动 if/else。

引导协议仍通过用户自然语言让模型调用插件，不由运行器直接调用某个厂商的 `remember` / `recall` 工具。这样保持端到端行为，同时不再把工具驱动插件错当作自动抽取插件。

入口：

```text
node src/run.mjs suite --catalog fixtures/catalog.json
node src/run.mjs suite --plugins mem9,dsh-mnemon
node src/run.mjs suite --plugins dsh-noema --protocol passive
node src/run.mjs suite --plugins dsh-noema --protocol guided
node src/run.mjs suite --protocol both --suite fixtures/locomo20.json --detach
node src/run.mjs suite --all-memory
node src/run.mjs suite --rankings test/fixtures/rankings-sample.json --dry-run
node src/run.mjs suite --dry-run
node src/run.mjs suite --plugins none --tasks T1 --detach --tester 实测
node src/run.mjs status
```

人只准备：C0 所用 DSH 已登录、模型能出字。第三方插件必须在低权限容器或独立系统账户内运行，设置 `DSH_EVAL_ISOLATED=1`，并用 `DSH_EVAL_CREDENTIALS_FILE` 指向本轮专用、短期、可撤销的凭据文件；要 Key 的插件再把名录 `requiredEnv` 声明的 Key 配好。运行器不会复制日常 DSH 凭据，也不会把未声明的 GitHub、AWS 等环境密钥传给插件子进程。脚本会自己建 `memory-eval` profile（`dsh-base` + `dsh-web-app`），不要抄日常 web，也不要用日常 web 当评测机。扫码 / 填 Key / 充额度不能自动。

评测 Host：`dsh --profile memory-eval --port 3180 --no-open`。

`close-session` 现在是真实生命周期屏障。由于 DSH Host API 没有单会话 close/dispose 方法，运行器会通过只监听 `127.0.0.1`、带随机令牌的评测控制插件，在 DSH 进程内触发其原生 `SIGTERM` 优雅清理；等插件和会话完成持久化、进程完全退出、端口关闭后才冷启动并追问。该控制插件不向模型提供工具或提示词。`kill-dsh` 仍是强制终止，用来单独测试崩溃恢复。`--no-host` 无法保证这一边界，因此遇到 `close-session` 会明确报错，不再伪装成已关会话。

## 现在怎么跑

```bash
cd evals/memory
npm test
node src/run.mjs suite --dry-run
node src/run.mjs suite --plugins mem9 --tasks T1 --dry-run
node src/run.mjs suite --catalog fixtures/catalog.json
node src/run.mjs suite --plugins mem9,dsh-mnemon
node src/run.mjs suite --plugins mem9,dsh-noema --protocol matched
node src/run.mjs suite --all-memory
node src/run.mjs suite --rankings test/fixtures/rankings-sample.json --dry-run
node src/run.mjs suite --plugins none --tasks T1 --detach --tester 实测
node src/run.mjs status
```

`--detach` 立刻返回，评测在后台写 `records/`。`--dry-run` 只打印步骤，不启 DSH、不调模型。同一轮再跑会跳过已打分的题；`--fresh` 重开。runId 包含协议，旧被动结果不会被新引导结果覆盖。改题只改 `fixtures/suite.json`，同步改 `test/score.test.mjs`。记分在 `src/lib.mjs` 的 `scoreAnswer`。加插件只改 `fixtures/catalog.json`。

## 约定

- 主账看记号，不上 LLM 裁判。过程账不加分、不进名次。
- 过程只看追问会话：最后一次 prompt token（不累加 chunk）、工具次数、注入条数、本题埋点回声、其他题埋点回声、追问耗时。和 C0 同题比增量。
- T7 灌窗仍只看废话回声，不用绝对 token 阈值。LoCoMo 的 `foreignEcho` 只做注释。
- `retrievedCount` 继续空着，直到插件有统一检索事件。
- 记录不写记忆库原文。
- 一次只装一个记忆插件。每条协议的 C0 必须先跑；不同协议不得相减或混排。
- 插件数据库必须落在本目标独立的 `DSH_HOME` 内。Noema 与 causal-memory 通过名录补丁覆盖其 OS 用户目录默认值，避免跨插件、跨条件泄漏。
- `dsh-memento` 的默认写入策略需要人工审批；`guided` 轨在非交互评测 profile 中明确改为 `writePolicy: auto`，结果元数据必须保留该协议配置事实。
- 每题开始先清空甲/乙工作区；埋点后、追问前再清一遍（只保留名录 wipe 里的插件库文件）。下一题不能读到上一题写进工作区的笔记。
- 所有埋点和追问会话强制使用 `memory-eval` 专用 agent preset。该 preset 不提供通用 Shell、文件搜索、Skills、Web 或子代理，防止模型绕过被测插件读取 `$DSH_HOME/sessions` 或工作区笔记。
- 观察器只读 `session.history`，不改 allow/deny。
- 不要把本目录加进根 workspace。

## 下一步（交接）

1. 给新插件审阅官方交互面，声明 `defaultProtocol` 和 `supportedProtocols`；不要直接沿用未知插件的 `passive` 默认值出正式榜。
2. 给常用插件补 wipe 路径和独立存储补丁；空表继续「未清干净」，不要猜目录去删。
3. `retrievedCount` 仍缺插件事件约定，有事件再填，没有就保持 null。
