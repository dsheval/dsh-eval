# DSH 搜索插件 Hard-12 测评

该目录测试清单中的 8 个 Search 插件，只评价检索与证据链，不评价 Deep Research 报告写作能力。现行正式套件为隔离版 `dsh-search-hard12-v2`；目录中的 v1、Hard-20 和已中止记录仅用于历史审计，因执行隔离和 `comparisonKey` 不同，不能充当 v2 正式基线。

第一次阅读代码可先看 [CODE-GUIDE.md](./CODE-GUIDE.md)，其中包含完整执行流程、文件树以及每个文件的职责。

## 题目来源

12 道题全部逐字读取自仓库中冻结的 [`deepresearch-bench-hard12.jsonl`](./fixtures/deepresearch-bench-hard12.jsonl)，不是本项目生成题。它们是原 Hard-20 中中文、英文各自官方难度排名前 6 的题目，题面和难度字段逐字不改。文件 SHA-256 固定为：

`212755ef041b2c71867abe8c05549ac6bb11ccbb962203e296a254cb07a1c060`

加载器同时核验哈希、12 个任务 id、顺序、6 中/6 英以及官方难度字段；测试还逐题比对原 Hard-20，防止题面被改写。任何一项变化都会拒绝正式运行。任务来自 [DeepResearch Bench 官方 query.jsonl](https://github.com/Ayanami0730/deep_research_bench/blob/main/data/prompt_data/query.jsonl)，难度来自其官方 GPT-5.5 leaderboard 的九系统逐题 RACE 数据。

## 八个条件

- S1 `liustack/modsearch`
- S2 `anysearch-team/anysearch-dsh`
- S3 `DDDMUC/dsh-free-search`
- S4 `anweat/dsh-web-search-pro`
- S5 `A3Boy/dsh-web-tools`
- S6 `gxpppp/dsh-search-mcp`
- S7 `Mr-remon219/dsh-search-boost`
- S8 `literaf/dsh-ai4scholar`

名录冻结了 npm 版本或 Git commit。S6 遵循上游要求使用本地 `link:` 安装；预检会核验源码目录的 HEAD 是否等于冻结 commit。S5 的上游文档将 Exa 列为新安装默认 provider，所以正式 documented-default lane 要求 `EXA_API_KEY`；S6 默认 Tavily，要求 `TAVILY_API_KEY`；S8 必须有 `AI4SCHOLAR_API_KEY`。缺凭据是 `ADMISSION_ERROR`，不记零分。

## 基线

- C0（正式基线）：同一 DSH、同一模型、同一参数、同一题面、同一时间批次，仅不安装额外搜索插件。所有插件提升只与 C0 做逐题配对比较。
- C1（诊断基线，可选）：保留 Web Host，但禁用 stock search provider 与 `tool-web`。它只观察任务是否仍诱发无证据的闭卷回答，不判断该回答正确，也不进排名、不作为插件优劣基线。
- 上游九系统平均 RACE：只用于证明 Hard-12 的难度并确定子集，不参与本地插件分数，因为模型、日期、工具和 Judge 均不同。

正式批次在开始和结束各运行一次 C0。插件逐题对比使用两个 C0 bracket 的指标均值；若 C0 前后漂移很大，应废弃该批次，而不是择优使用其中一次。

默认正式计划是 12 个唯一任务 ×（8 插件 + 2 次 C0）= 120 次条件任务。C1 默认关闭；显式选择 C1 会再增加 12 次诊断运行。

基础 `DSH_HOME` 必须是干净的评测配置：可以保留模型 settings 和 credentials，但 `settings.yaml` 中不得残留这八个插件的配置。预检只记录 settings 哈希与命中的插件名，不记录配置正文。

每个隔离条件只继承其 `requiredCredentialRefs`。当前 documented-default lane 不复制 `optionalCredentialRefs`，所以本机偶然存在的 Tavily、Exa、Brave 等 Key 不会悄悄改变其他插件的默认 provider。要测试满配上限，应复制名录建立独立 `best-configured` lane 和新的 comparison key。

## 执行隔离与失控保护

- 每道题使用全新的 session、workspace 和 DSH Host 进程；该题记录落盘前 Host 必须停止，旧会话不可能与下一题并行。
- 所有条件显式使用同一 `search-eval` agent preset。它只包含回答、上下文压缩和 `tool-web`，不挂载 Skills、Canvas、Shell、文件、目标、计划、子代理或工作流。
- 原题仍作为唯一用户消息逐字发送；search-only preset 属于所有条件共享且哈希记录的系统实验环境，不修改题面。
- 单题有 30 分钟严格墙钟超时、24 个 agent step 和 48 次观察到的工具调用预算。出现禁用工具、超时或预算超限时立即记 `SYSTEM_ERROR`，调用 `session.cancel`，保存诊断历史并停止整题 Host。
- `SYSTEM_ERROR` 不调用 URL 检查或 Judge，不进入质量排名；取消和回收耗时单独记录，不混入模型回答延迟。

agent preset、Host 隔离方式和预算全部进入 `comparisonKey`，任何一项变化都会使旧记录自动不可比。

## 评分输出

不合成一个任意加权总分。报告保留以下指标向量，并以风险优先的逐题 `WIN/TIE/LOSS` 汇总：

- 检索激活率、工具成功率、结构化字段完整率；
- 检索 URL 可打开率、唯一域名数；
- 引用正确性、引用完整性、关键主张支持率；
- 原始/权威来源比例与来源质量；
- 捏造引用、错误、超时、回退可见性；
- 延迟和调用数仅作为成本诊断，不奖励“调用更多”。

Judge 确认存在捏造引用时直接质量失败；单纯的 URL 格式或可访问性错误只会使引用完整性门槛失败，不等同于捏造。没有观察到搜索/抓取调用，或没有产生可审计 URL，记为 `RETRIEVAL_FAIL`。安装、凭据、宿主和 Judge 故障分别记为非质量错误并从排名分母排除。

报告同时读取每个 run 的 `meta.json`，所以即使某插件在 admission 或安装阶段一题都没产出，也不会从报告里消失。只有 8 个插件各有 12 条可排名记录（不能用 `SYSTEM_ERROR` 凑足数量）、C0 漂移合格且批次未超过时间窗时，整批才标为 `publishable`。

## 安全边界

`validate`、`plan`、`preflight` 和 `report` 不启动 DSH，不安装插件，也不调用搜索或 Judge。`run` 有双重锁，只有同时提供命令行 `--execute` 和专用确认环境变量才会执行。具体操作边界见 [DEVELOPMENT.md](./DEVELOPMENT.md)。
