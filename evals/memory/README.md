# DSH 记忆插件评测

按 [benchmark.md](./benchmark.md) 跑插件互比。一次只装一个记忆插件；会话内能答不算记住。插件按交互面进入 `passive`（零提示自动记忆）或 `guided`（显式要求使用持久记忆）协议，结果只在同协议内比较。

人先在 DSH 里埋点、关会话、抄回答。这里只固定题面、开轮次、对记号打分。自动化编排见 [DEVELOPMENT.md](./DEVELOPMENT.md)。

## 文件树

```text
evals/memory/
├── README.md                 本文件：入口、文件职责、手工怎么跑
├── DEVELOPMENT.md            自动化设计、suite 入口、下一步（交接看这个）
├── benchmark.md              测评标准原文（规矩、C0+名录、八题、两本账）
├── package.json              本目录脚本：npm test / npm start
├── fixtures/
│   ├── suite.json            题集：记号和 T1–T8，不含插件名单
│   ├── catalog.json          名录：C0 + 每个插件的 add / wipe / 冲突 / 协议
│   └── patches/              插件隔离与非交互评测所需的最小配置补丁
├── schema/
│   ├── record.schema.json    单题记录字段
│   └── catalog.schema.json   名录行字段
├── src/
│   ├── lib.mjs               读题集、拼埋点、主账记分、空记录
│   ├── catalog.mjs           读名录、按名筛选、从总榜筛记忆向插件
│   ├── profile.mjs           确保独立 memory-eval profile（web bundles + 生命周期补丁）
│   ├── eval-lifecycle-plugin.mjs  仅供评测器触发 DSH 原生优雅关闭
│   ├── plugin-ops.mjs        dsh plugin add/remove；按 wipe 表清库
│   ├── host.mjs              Host RPC、启停 DSH、抽最后一条助手文本
│   ├── observe.mjs           只读 history，折过程账（含 T7 灌窗）
│   ├── protocol.mjs          协议选择、通用引导语、协议配置补丁
│   ├── suite-runner.mjs      对名录每个目标走同一套编排
│   ├── progress.mjs          每题落盘、续跑、后台 job / status
│   ├── run.mjs               CLI：new / prompt / score / summary / status / suite
│   └── export-site.mjs       将完整榜单裁剪为前端可公开的精简快照
├── test/
│   ├── score.test.mjs        八题过/不过的记分单测
│   ├── catalog.test.mjs      名录解析、C0 强制、all-memory 过滤
│   ├── host.test.mjs         RPC 信封、环回、抽回答
│   ├── observe.test.mjs      过程账 / T7 灌窗
│   ├── runner.test.mjs       dry-run 计划、题废判定、wipe 边界
│   └── fixtures/
│       └── rankings-sample.json  all-memory 过滤用的总榜样例
└── records/
    ├── .gitignore            忽略轮次目录，避免把回答提交进库
    └── .gitkeep              占位。结果在 records/<runId>/，不要贴记忆原文
```

评测用的甲/乙工作区在 `~/.dsh/memory-eval-workspaces/`（DSH home 下，不在本目录）：放在评测根目录旁会让被测模型读到 `fixtures/` 题面和 `records/` 日志，污染结果。`records/<runId>/` 跑起来后才会出现：`meta.json` 是整轮环境，`T1.json`–`T8.json` 是单题记录。

## 怎么跑

```bash
cd evals/memory
npm test
node src/run.mjs new --condition C0 --protocol passive --tester 你的名字
node src/run.mjs prompt <runId> T1 seed    # 贴进会话 A
node src/run.mjs prompt <runId> T1 probe   # 关会话后贴进会话 B
node src/run.mjs score <runId> T1 --answer "模型原话"
node src/run.mjs summary <runId>
```

T7 若整库灌窗，记分时加 `--dumped`。自动跑用 `suite --detach`，查进度 `node src/run.mjs status`。见 [DEVELOPMENT.md](./DEVELOPMENT.md)。

自动跑默认 `--protocol matched`：`mem9`、`graph-memory` 走 `passive`；依靠模型调用记忆工具的插件走 `guided`。要专门测所有插件的零提示体验，用 `--protocol passive`。`matched` 若同时包含两种协议，会分别跑 `C0:passive` 与 `C0:guided`；运行目录和排行榜也带协议名，不会混账。

完整双轨复测使用 `--protocol both`，运行器会串行跑完 `passive` 再跑 `guided`，不会同时安装两个插件或让两条轨争用 Host。

完成双轨榜单后，用下面的命令生成网站读取的脱敏快照。它只导出排行、正确率、延迟、Token、工具调用与协议说明，不会导出逐题回答、本机路径或会话记录。

```bash
npm run export:site -- --day 2026-08-28
```

默认同时输出到 `../../app/data/memory/locomo20-<day>.json` 与 `../../public/data/memory/locomo20-<day>.json`：前者供榜单组件编译读取，后者供用户下载。

自动化里的 `close-session` 会真正优雅关闭当前 DSH Host，等待进程退出后冷启动，再创建追问会话；它不是“仅创建一个新会话”的占位动作。历史结果不会因代码修复而自动重算，需要用 `--fresh` 重跑后才能公平比较。

## 交接看哪

| 想知道 | 看 |
| --- | --- |
| 什么叫过、怎么记两本账 | `benchmark.md` |
| 做到哪、自动化怎么跑 | `DEVELOPMENT.md` |
| 埋点句有没有被改过 | `fixtures/suite.json` |
| 要测哪些插件、怎么装、清哪里 | `fixtures/catalog.json` |
| 记分为什么和预期不一致 | `src/lib.mjs` + `test/score.test.mjs` |
| 某轮原始结果 | `records/<runId>/` |
