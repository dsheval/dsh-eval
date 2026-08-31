# Search Hard-12 评测规范

## 1. 研究问题

在宿主、主模型、模型参数、原始题面、网络时间窗与 Judge 固定时，额外 Search 插件相对 stock DSH（C0）是否改善了可审计检索和证据支持？

这不是“哪一个 Agent 写的报告最好”。最终回答只是承载引用和主张的容器，文风、篇幅、章节组织、生成文件与 Deep Research 工作流不计分。

## 2. 实验单位与公平性

实验单位是 `condition × upstream task × attempt`。每个任务建立新 session、新 workspace 和新 DSH Host；每个条件使用独立的 DSH_HOME。原题作为唯一用户消息逐字发送，不加用户消息 wrapper。所有条件共享同一个哈希冻结的 search-only agent preset，只提供网页检索与回答，排除 Canvas、Skills、Shell、文件和子代理等与搜索插件无关的路径。

正式可比记录必须具有相同的 `comparisonKey`，它覆盖：题集 id、题集文件哈希、credential lane、主模型标签、Judge 模型、完整执行隔离/预算配置和门槛版本。一次 batch 原则上在 48 小时内完成。

单题限制为 30 分钟严格墙钟、24 个 agent step 和 48 次观察到的工具调用。禁用工具泄漏、预算超限或墙钟超时都会触发 `session.cancel`；无论取消是否成功，该题 Host 都会在下一题开始前停止。此类记录是 `SYSTEM_ERROR`，不调用 Judge、不进入插件质量排名，取消和历史回收时间也不计入回答延迟。

插件条件的顺序按冻结 seed 与 batch id 确定性打乱，C0 固定在批次首尾。两个 C0 bracket 在七个核心指标上的逐题平均绝对漂移任一超过 0.15，或任务状态不一致率超过 0.25，整批配对结论标为 `NOT_COMPARABLE`。C1 默认不运行；它只诊断“禁用检索后是否仍生成无证据回答”，不提供正确率基线。

## 3. Credential lane

首个正式 lane 是 `documented-default`：按各插件上游文档的新安装默认 provider 运行。这测量“真实默认产品条件”，不是强行把所有插件接到同一搜索后端。可另建 `common-provider` 或 `best-configured` lane，但不得跨 lane 合榜。

所有条件需要 `DEEPSEEK_API_KEY` 作为主模型凭据。插件特有的必需凭据只做存在性检查，绝不写入结果。匿名额度、付费额度和缓存状态应在元数据或人工运行日志中备注。

隔离 DSH_HOME 只接收该条件的 `requiredCredentialRefs`；`optionalCredentialRefs` 不进入 documented-default lane。基础 `settings.yaml` 的哈希进入 comparison key，并在每个条件启动前复核，运行中变化会终止批次。

## 4. 确定性门槛

正式 PASS 至少满足：

1. 至少一次搜索或抓取调用；
2. 至少一个工具轨迹中的 HTTP(S) URL；
3. 至少一个检索 URL 可打开；
4. 工具结果成功率不低于 0.5；
5. 结果的 URL/title/snippet 结构完整率不低于 0.5；
6. Judge 的关键主张支持率不低于 0.6；
7. Judge 引用正确性不低于 0.5；
8. 没有捏造引用。

Judge 只看冻结输入、回答、工具证据摘录和 URL 检查，不独立联网。这样避免 Judge 使用额外搜索引擎把检索能力“补回来”。它评的是“回答是否被被测插件实际找到的证据支持”。

## 5. 配对比较

首先比较捏造引用风险，低风险者胜。风险相同时，按关键主张支持、引用正确性、引用完整性、来源质量、URL 有效率、工具成功率、结构完整率逐项计算差值。单项差至少 0.05 才视为有意义；WIN 必须比 LOSS 多至少两项，否则为 TIE。

最终报告公开每项均值、逐题 W/T/L、非质量错误和任务覆盖率，不发布一个混合权重总分。

## 6. 方法依据

- DeepResearch Bench（2025）提供开放式深度研究任务与 RACE 引用评价框架：[paper](https://arxiv.org/abs/2506.11763)
- CiteEval（ACL 2025）把引用正确性和完整性视为可分离维度：[paper](https://aclanthology.org/2025.acl-long.1285/)
- DeepFact（ACL 2026）强调长回答的细粒度事实核查；本套件借鉴其“主张级”思想，但不冒充完整复现其 benchmark：[paper](https://aclanthology.org/2026.acl-long.1586/)

这些论文支撑评价维度；本地 Hard-12 仍保持上游原题，不据此生成新题。Hard-12 从已冻结 Hard-20 中按语言分别保留官方 GPT-5.5 平均 RACE 最低（最难）的前 6 题，形成中文 6 题、英文 6 题的等比例子集。
