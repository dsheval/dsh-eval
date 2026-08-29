# DSHEval 榜单语言参考

更新日期：2026-08-29

本笔记比较 SWE-bench、Arena、Stanford HELM 与 MLPerf / MLCommons 的官方页面，供 DSHEval 首页、结果页和方法页统一文案时使用。这里只讨论语言层级，不规定视觉样式。

## 核心结论

权威感主要来自可核对的事实，而不是学术措辞：先用一句普通语言说明“测什么”，再给出分数、样本量、日期、版本与状态，最后把复杂方法和限制放到详情层。

DSHEval 的原则是：**减少抽象名词密度，不减少证据密度。**

## 官方榜单的共同写法

### SWE-bench

- 榜单入口直接使用 `Official Leaderboards`、`Compare results`，分组直接按 `Verified`、`Multimodal`、`Lite` 等测试集命名。
- 核心指标 `% Resolved` 紧跟白话定义；比较条件会明确说明相同运行环境和不可直接比较的版本。
- 方法、复现和版本细节另设页面，不压在核心结果前。

参考：[SWE-bench 官方榜单](https://www.swebench.com/index.html)、[SWE-bench Verified](https://www.swebench.com/verified.html)

### Arena（原 LM Arena）

- 榜单先展示更新时间、票数、模型数、分数与排名区间。
- 用户流程被写成短动作：输入问题、比较回答、选择更好的结果。
- `Preliminary`、`N/A`、分数误差和票数直接出现在结果附近，榜单变更另有更新记录。

参考：[Arena Text Leaderboard](https://arena.ai/leaderboard/text)、[How Arena Works](https://arena.ai/how-it-works)、[Arena Leaderboard Policy](https://arena.ai/blog/policy/)

### Stanford HELM

- 面向结果的标题使用 `Results and Insights`、`Mean score`、`Overall Results` 等明确名称。
- 专业性下沉到 `Basic Setup`、`Metrics`、`Implementation Details`、`Pipeline Robustness` 等方法小节。
- 限制写成具体失败模式，并提供固定版本的榜单快照。

参考：[HELM Capabilities 说明](https://crfm.stanford.edu/2025/03/20/helm-capabilities.html)、[HELM Leaderboards](https://crfm.stanford.edu/helm/index.html)

### MLPerf / MLCommons

- 顶层先说明测试对象和核心读数，再提供完整规则。
- 表格字段指向可核对的对象，如提交者、软件、系统、处理器、结果、详情和代码。
- `verified`、`provisional`、`unverified` 等状态有固定定义；结果修正有变更记录。

参考：[MLPerf Inference: Datacenter](https://mlcommons.org/benchmarks/inference-datacenter/)、[MLPerf Endpoints](https://mlcommons.org/benchmarks/endpoints/)

## DSHEval 文案规则

1. 标题先回答“这是什么、测什么”。优先使用“测试结果”“真实任务评测”“跨会话记忆”，少用“能力观测框架”“多维证据档案”。
2. 指标名后立刻补一句白话定义，例如“正确率：答案命中标准答案或包含全部必需信息”。
3. 结果句尽量包含对象、条件和数字，例如“7 个 Agent 分别完成两种模式下的 20 道题”。
4. 在结果附近明确样本量、测试日期、版本和状态；把环境配置、评分细则与复现步骤放入“评测方法”。
5. 限制必须具体，例如“样本不足，当前为初步结果”“不同版本不能直接比较”“评测程序故障任务已按原条件补测”。
6. 状态使用固定短词，例如“已收录”“已完成测试”“已独立复测”“无法评测”。
7. 按钮直接说明结果，例如“查看完整排名”“查看评测方法”“下载结果数据”，避免“探索全景”“进入证据空间”。

## 推荐词汇层级

| 层级 | 推荐用语 |
| --- | --- |
| 排名 | 总榜、分类榜、排名、得分、正确率、样本数、更新时间 |
| 结果 | 总体结果、分项结果、领先项、薄弱项、成功案例、失败案例 |
| 方法 | 评测方法、运行环境、任务与指标、评分方式、复现说明、完整规则 |
| 限制 | 结果说明、版本差异、样本不足、结果可能更新、已修正问题 |
| 状态 | 已核查、初步结果、未核查、已收录、已完成测试、已独立复测 |
| 行动 | 比较结果、查看详情、查看方法、查看规则、下载数据、复现测试 |

## 首屏信息顺序

1. 测试对象与用途。
2. 最新结果、核心指标和样本量。
3. 测试状态与具体限制。
4. 评测方法、原始数据和复现入口。

技术对象名如 `Trace`、`State`、`EvidenceBundle`、`Judge` 和 `Registry` 只在开发者文档或方法细节中使用；面向普通读者时分别写成“操作过程”“状态变化”“完整记录”“评分方式”和“结果库”。
