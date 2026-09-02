# Deep Research 评测开发说明

## 架构

- `config.mjs`：加载、合并和校验 suite、catalog、私有短事实题。
- `host.mjs`：只与本机环回 DSH Host RPC 通信，聚合父子会话，并执行研究工具、重复查询及无进展熔断。
- `profile.mjs`：为每个条件创建独立 `DSH_HOME`、Profile 和工作区。
- `plugin.mjs`：准入预检与插件安装；源码、版本、平台和 Docker 条件不满足时 fail closed。
- `observe.mjs`：从 session history 折叠过程账。
- `url-check.mjs`：检查引用 URL 通断，不把通断误当引用忠实。
- `score.mjs`：确定性评分、结果账和 C0 增量判定。
- `judge.mjs`：默认启用的 OpenAI-compatible LLM Judge 调用。
- `runner.mjs`：紧凑版 R1/R3/R6/R7、R10 派生、分轨预算和记录落盘。
- `report.mjs`：多指标汇总，不生成单一加权总分。

## 执行锁

`plan`、`validate`、单元测试绝不启动 DSH。

正式 `run` 必须同时满足：

```text
命令参数：--execute
环境变量：DSH_RESEARCH_EVAL_EXECUTE=I_UNDERSTAND_THIS_STARTS_DSH
```

缺一项立即退出。这个锁用于防止“检查代码”意外产生 API 消耗。

## Key

- 被测 Agent 使用 DSH 凭证存储中的模型 Key。
- P7 需要 `AI4SCHOLAR_API_KEY`，本轮按用户决定排除，不运行也不计零分。
- P5 免费搜索层不要求 Key；Tavily、Exa、Brave 和 X Key 只作为可选能力，必须在报告中注明是否启用。
- LLM Judge 默认读取本地 DSH 凭证或环境变量中的 `DEEPSEEK_API_KEY`，也可由 suite 修改 Key 引用名。
- Key 只做存在性检查；日志仅记录 `present/missing`。

## WSL 准入环境

P1 Hanai 和 P3 Scholar 不是普通的注册表安装。`scripts/prepare-wsl.sh` 在 Ubuntu/WSL 内准备固定 Node 24.19、pnpm、DSH 0.1.1-rc.2、源码构建和原生 Docker Engine；依赖放在 `~/.local/share/dsh-research-eval`，不写入仓库。P1 调用上游专用 Profile 安装器，P3 从构建后的本地源码安装。runner 会检查构建产物、Node/DSH 版本以及 P3 的 Docker daemon，任一缺失都 fail closed。

固定工具链、源码构建、冒烟检查和正式评测使用专用非 root 账户 `dsheval`；只有安装或启动系统级 Docker Engine 时使用 `root`。`dsheval` 的 `~/.dsh/.credentials.yaml` 应只包含本轮需要的短期凭据，权限必须为 `0600`。

```powershell
wsl.exe -d Ubuntu -u dsheval -- bash /mnt/d/dsh-eval/evals/deep-research/scripts/prepare-wsl.sh build-p1
wsl.exe -d Ubuntu -u dsheval -- bash /mnt/d/dsh-eval/evals/deep-research/scripts/prepare-wsl.sh build-p3
wsl.exe -d Ubuntu -u root -- bash /mnt/d/dsh-eval/evals/deep-research/scripts/prepare-wsl.sh docker
```

源码 Profile 冒烟检查只做安装与组合配置验证，不启动 DSH Host、不调用模型：

```powershell
wsl.exe -d Ubuntu -u dsheval -- bash -lc 'export DSH_RESEARCH_EVAL_DEPS="$HOME/.local/share/dsh-research-eval"; export PATH="$DSH_RESEARCH_EVAL_DEPS/runtime/node-v24.19.0/bin:$HOME/.local/bin:$PATH"; cd /mnt/d/dsh-eval/evals/deep-research; node scripts/admission-smoke.mjs P1'
wsl.exe -d Ubuntu -u dsheval -- bash -lc 'export DSH_RESEARCH_EVAL_DEPS="$HOME/.local/share/dsh-research-eval"; export PATH="$DSH_RESEARCH_EVAL_DEPS/runtime/node-v24.19.0/bin:$HOME/.local/bin:$PATH"; cd /mnt/d/dsh-eval/evals/deep-research; node scripts/admission-smoke.mjs P3'
```

其他插件走独立目标 DSH_HOME。即使卸载失败，也不会污染下一插件的 Profile。

## 私有短事实题

R1–R4 已从 `D:\True\benchmarks` 的本机受保护数据冻结到 `fixtures/private-tasks.local.json`，V8 Compact 只加载 R1/R3。该文件包含 prompt、gold、上游 task ID 和来源哈希，被 Git 忽略且不得提交或上传。正式 run 在任一启用题面、gold、来源 task ID 为空或仍含“填写 / TODO / TBD”等模板占位符时 fail closed。

V11 Calibrated Protocol 使用 DeepResearchEval v1 的 R6/R7；R8 从紧凑轮排除，R5 已删除。suite 里的强制交付物和可打开 URL 门槛属于 TrueEval/DSH 诊断增强，不应伪装成上游原始评分规则。

## 运行预算与熔断

`fixtures/suite.json` 按 `SF / LF / PRODUCT` 冻结 `maxBudgetedCalls`、`maxQueryRepeats` 和 `noProgressMs`，`budgetPollIntervalMs` 决定检查频率。`host.mjs` 从根会话及其递归子会话 history 统计实际调用；管理型工具和文件读写只保留审计数，不进入研究工具预算。归一化后的相同查询超过上限会触发独立熔断。会话树的 `updatedAt` 与聚合历史尾事件共同判断是否真正无进展。

V11 为短事实设置 12 次搜索/40 次研究工具预算，为长文设置 24 次搜索/72 次研究工具预算和 40 分钟运行保护；协议要求在 20 次搜索内停止扩张，并至少保留 12 次工具调用用于综合和引用检查。预算中断后若题目 `cwd` 内已有最终报告，runner 仍检查 URL 并调用 Judge。DeepSeek `TRANSPORT/TIMEOUT/SERVER/RATE_LIMIT/EMPTY_RESPONSE` 会从历史事件提升为 `SYSTEM_ERROR` 并自动重试最多两次；R10 会传播不可评分状态，而不是制造质量 FAIL。Judge 只读取聊天回答和明确的最终报告，token 则按父子会话分别取累计最大值后求和。

DSH Host 从每个条件自己的隔离 `DSH_HOME` 启动，不从 `evals/deep-research` 启动；任务工作区也位于该隔离目录。这样被测 Agent 不会因当前工作目录位于评测仓库而直接看到私有 gold、规则文件或其他条件的记录。

## 只读验证

```powershell
npm run validate
npm run plan
npm test
```

正式使用 P1/P3 时，应在 WSL 中通过 `bash scripts/research-eval-wsl.sh validate --strict` 和 `bash scripts/research-eval-wsl.sh plan` 预检；Windows 侧的 `plan` 会按设计将仅支持 Linux 的 P3 判为平台不兼容。

## 正式运行（当前不要执行）

```powershell
$env:DSH_RESEARCH_EVAL_EXECUTE='I_UNDERSTAND_THIS_STARTS_DSH'
node src/run.mjs run --execute --target C0
```

长文 Judge 默认启用，不需要额外传 `--judge`。没有 Judge Key 时预检失败，不会先生成一半再悄悄降级；只有明确的诊断运行可传 `--no-judge`，该模式下长文记为 `NOT_SCORED`，不进入正式质量榜。
