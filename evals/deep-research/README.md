# DSH Deep Research 插件评测

本目录用于横向测试 DSH 生态中的 Deep Research 插件，不复跑 Kimi、秘塔、豆包、千问或智谱等产品。

插件名录仍保留 P1–P8；本轮按用户决定排除缺少 `AI4SCHOLAR_API_KEY` 的 P7。P7 不运行、不计零分，也不进入榜单，实际正式条件为 C0 + 7 个插件。

当前设计是 **8 个独立题面、10 个测评项**：R1–R4 来自本机冻结的 xbench-DeepSearch 2505 与 BrowseComp-ZH，R5–R8 来自公开的 DeepResearchEval v1，R9 对 R5 做中断恢复，R10 从 R5 产物派生“搜索是否等于研究”的判定。

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
│   ├── suite.json               8 个题面、10 个测项
│   ├── catalog.json             C0 + 8 个插件
│   ├── source-lock.json         P1/P3/DSH 源码 commit 与归档哈希
│   └── private-tasks.example.json  R1–R4 私有题面/金标模板
├── schema/                      套件、名录、单题记录结构
├── src/                         校验、编排、观察、评分、Judge、汇总
└── test/                        纯本地单元测试
```

R1–R4 的短事实题面、gold 和上游来源哈希放入本机 `fixtures/private-tasks.local.json`，该文件被 Git 忽略，不能提交或上传明文。R5–R8 保留 DeepResearchEval 的公开英文原题。R9/R10 是 DSH 插件产品诊断，不是上游官方题。

这是一套固定的小样本插件横评，不宣称复现三个上游 benchmark 的官方完整榜单。短事实答案准确率、长文质量、事实核查和引用诊断分别报告，不融合成一个“官方总分”。

## 只读命令

```powershell
cd D:\dsh-eval\evals\deep-research
npm run validate
npm run plan
npm test
```

正式执行命令见 [DEVELOPMENT.md](./DEVELOPMENT.md)，在用户明确同意开跑前不要使用。
