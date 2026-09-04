# Deep Research V12：公开运行数据与榜单

这是本机真实评测记录的脱敏发布，不是模拟数据，也没有重新运行模型。覆盖 C0 原生基线及 P1/P2/P3/P4/P5/P6/P8 七个插件，共 40 条正式选择的记录。

- Suite：`dsh-research-eval-v12-r3-refresh`。
- 每个条件含 R1、R3、R6、R7、R10；R10 从 R6 派生，不能当作第五次独立研究。
- V12 组合统一补跑的 R3 与已验证的旧记录；逐条保留复用标记、来源 Suite 和匿名来源指纹。
- 私有题面/金标、原始回答、完整日志和旧失败批次仍保存在本机，不在本发布中。

## 文件树与作用

```text
results/v12/
├── README.md                发布范围、字段边界、指标口径和复核命令
├── results.json             全部 40 条白名单脱敏后的过程账、结果账与 Judge 数值
├── leaderboard.json         从同一份公开记录复算的 C0 摘要和七插件榜单
├── leaderboard.html         独立离线榜单，含逐题结果、过滤、记录下钻与 JSON 下载
├── process-monitoring.html  独立离线过程监控，含资源、工具、异常、来源和保护触发
└── manifest.json            四个生成文件的 SHA-256、字节数和发布元数据

../../src/public-results.mjs          字段白名单、类型校验、匿名化及榜单复算
../../src/public-results-html.mjs     仅接受脱敏对象的 HTML 渲染器
../../scripts/export-public-results.mjs  本地原始记录导出和公开文件完整性验证入口
../../test/public-results.test.mjs    注入敏感字段、数值一致性及离线 HTML 测试
```

GitHub 文件页会显示 HTML 源码。下载 `leaderboard.html` 或 `process-monitoring.html` 后可以直接离线打开；两个 HTML 均内嵌所有公开数据，不依赖外部脚本、字体或服务。相邻文件链接需要同时下载对应文件。

## 脱敏策略

采用“重新构造字段白名单”，而非仅替换看起来像 Key 的字符串。新增未知字段默认不会进入公开数据。

保留：

- 插件条件、冻结插件名、题目 ID/轨道、时间、状态、评分数值、相对 C0 增量。
- 输入/输出/总 Token、耗时、成本原始字段（未记录时保持 null）、运行预算及标准触发码。
- 工具类别及受控工具名称计数、查询总数/去重计数、错误/超时/重试/Fallback 等原始命中数。
- 来源总数、检查数、可达数、匿名来源的 HTTP 状态及是否被回答引用。
- 匿名产物编号、受控扩展名、大小和可读/计分标记，不保留路径或内容。
- Judge 数值及状态、整题尝试次数、丢弃基础设施错误数量及受控错误码。

移除：

- 题目标题、完整题面、标准答案、模型回答、推理/流式片段、证据摘录、Judge 理由。
- 所有工具参数、返回正文、异常消息、查询词、完整 URL/域名、来源正文。
- 所有本机路径、工作区/用户名、会话标识、凭证、插件产物文本。
- 交付物检查的原始 ID/描述、自由文本理由及任意未知嵌套字段。

原始运行 ID 只生成匿名来源指纹，用于关联同源记录；不发布私有题目或答案的哈希。可疑新枚举或非数值指标会拒绝导出，不会把原始输入回显到错误信息。

## 指标解释与局限

- 导出器会断言公开数据与原始数据经既有 `aggregateRecords`、`rankSummaries` 计算的全部榜单指标与顺序一致。没有新建加权总分。
- SF 是短事实检索，LF 是长报告研究，PRODUCT 是产品诊断；小样本结果不等于上游 benchmark 的完整官方榜单。
- 异常数及 `manualInterventions` 是历史文本规则命中次数，可能重复或误命中，不代表同数量的独立故障、真实超时、真实重试或真人审批。
- `completedSteps = 0` 可能是未检测到规定格式的完成标记，不等于没执行研究。版本化标记同样是原始启发式结果。
- R10 资源值为 null：它是派生指标，不应补成零或增加独立调用数。均值沿用既有汇总函数，只统计实际有数值的记录。
- 来源 URL 数不是全量 URL 复核数；只有 `checkedUrls` 范围内执行了可达性检查。
- 公开 Token/耗时保留原始账本口径；不宣称包含所有被丢弃的尝试及 Judge 成本，不代表供应商账单合计。
- 删除私有文本后，公众可复算榜单和审计过程指标，但不能单凭本数据重新核验私有答案、引用忠实度或复现模型原始轨迹。

## 不调用模型的复核

在仓库根目录执行：

```bash
npm run test:deep-research
node evals/deep-research/scripts/export-public-results.mjs --verify evals/deep-research/results/v12
```

完整性验证会检查四个生成文件的哈希/字节数、40 条记录、榜单复算一致性、两份 HTML 的内嵌数据一致性及交互脚本语法。
本目录通过 `.gitattributes` 固定为 LF 换行，避免 Windows 检出时 CRLF 转换导致完整性哈希变化。

有权限读取本机原始记录时，可以重新导出（只读源目录，不运行 DSH 或模型）：

```bash
node evals/deep-research/scripts/export-public-results.mjs --source <本机原始records目录> --out evals/deep-research/results/v12
```

原始 `records/` 的 Git 忽略规则保持不变。请勿以 `git add -f records/` 的方式绕过该边界。
