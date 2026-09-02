# DSH Deep Research 插件评测

本目录用于横向测试 DSH 生态中的 Deep Research 插件，不复跑 Kimi、秘塔、豆包、千问或智谱等产品。

插件名录仍保留 P1–P8；本轮按用户决定排除缺少 `AI4SCHOLAR_API_KEY` 的 P7。P7 不运行、不计零分，也不进入榜单，实际正式条件为 C0 + 7 个插件。

当前正式轮使用 **V11 Calibrated Protocol：4 个独立题面、5 个测评项**。R1/R3 是短事实，R6/R7 是长报告，R10 是从 R6 派生的产品诊断，题型比例 `2:2:1` 与原 V4 的 `4:4:2` 完全一致。R2、R4、R8、R9 不进入紧凑轮，R5 已删除。V11 为短事实设置 12 次搜索/40 次研究工具预算，为长文设置 24 次搜索/72 次研究工具预算和 40 分钟运行保护，并在 WSL 正式入口自动桥接 Windows 本机代理、探测 DeepSeek/GitHub 连通性。

## 安全状态

- `validate` 和 `plan` 只读，不启动 DSH、不安装插件、不调用模型。
- `run` 默认拒绝执行。正式开跑必须同时传 `--execute`，并设置确认环境变量。
- 长文 LLM Judge 默认启用，从本地 DSH 凭证或配置声明的环境变量读取 DeepSeek Key；只有显式传 `--no-judge` 才关闭。
- Key 只检查是否存在，不写入记录、日志或报告。

## 文件

```text
evals/deep-research/
├── benchmark.md                 冻结的测试规则
├── DEVELOPMENT.md               代码结构与执行边界
├── fixtures/
│   ├── suite.json               4 个题面、5 个测项及分轨预算
│   ├── catalog.json             C0 + 8 个插件
│   ├── source-lock.json         P1/P3/DSH 源码 commit 与归档哈希
│   └── private-tasks.example.json  R1–R4 私有题面/金标模板
├── schema/                      套件、名录、单题记录结构
├── src/                         校验、编排、观察、评分、Judge、汇总
└── test/                        纯本地单元测试
```

紧凑版使用的 R1/R3 短事实题面、gold 和上游来源哈希放入本机 `fixtures/private-tasks.local.json`，该文件被 Git 忽略，不能提交或上传明文。R6/R7 保留 DeepResearchEval 的公开英文原题。R10 是 DSH 插件产品诊断，不是上游官方题。

每题会话直接以隔离题目目录作为 `cwd`，因此最终报告会在正确目录被收集。运行器聚合父会话及所有子代理的历史：搜索次数不设上限，`list_agents`、待办和文件读写不消耗研究工具预算；外部读取、计算型调用、同一查询重复次数与真正无进展分别受控。长文还会注入统一的 bounded-evidence 协议，要求分工、证据饱和后早停并避免轮询子代理。预算触发但已有报告时仍执行 URL 检查和 Judge，保留内容质量结果并把原本的 `PASS` 降为 `PARTIAL`；只有没有可评分回答或产物时才直接记 `FAIL`。

这是一套固定的小样本插件横评，不宣称复现三个上游 benchmark 的官方完整榜单。短事实答案准确率、长文质量、事实核查和引用诊断分别报告，不融合成一个“官方总分”。

## 只读命令

```powershell
cd D:\dsh-eval\evals\deep-research
npm run validate
npm run plan
npm test
```

正式执行命令见 [DEVELOPMENT.md](./DEVELOPMENT.md)，在用户明确同意开跑前不要使用。
