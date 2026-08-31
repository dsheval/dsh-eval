# 开发与执行边界

## 只读命令

以下入口不安装插件、不启动 DSH、不调用模型或联网搜索：

```powershell
cd D:\dsh-eval\evals\search
npm run validate
npm run plan
npm run preflight
npm run report
```

`npm test` 是本地单元测试，不启动 DSH 或调用搜索服务。

## 正式运行前准备

S6 必须由操作者把上游源码 checkout 到 `$env:DSH_SEARCH_EVAL_DEPS\sources\dsh-search-mcp`，安装其依赖，并保证 HEAD 等于 catalog 中的冻结 commit。代码不会擅自 clone 或更新外部仓库。

还需设置不含密钥的批次元数据：

```powershell
$env:DSH_SEARCH_EVAL_MODEL_LABEL = '<exact model and parameter label>'
$env:DSH_SEARCH_EVAL_BATCH_ID = '<one batch id>'
```

正式 `run` 会复制现有 DSH settings/credential 引用到各条件的隔离 DSH_HOME，安装冻结插件，并为每道题单独启动和停止一个 DSH Host。每题显式选择自动生成且哈希记录的 `search-eval` preset；该 preset 不提供 Skills、Canvas、Shell、文件或子代理工具。成功回答才检查来源 URL 并调用盲评 Judge。它故意要求双重显式授权：

```powershell
$env:DSH_SEARCH_EVAL_EXECUTE = 'I_UNDERSTAND_THIS_STARTS_DSH_SEARCH_EVAL'
node src/run.mjs run --execute
```

建议先仅跑 C0 + 单插件做 admission smoke，再开启完整 12 题批次；smoke 记录不能混入正式榜单。

单题同时受严格墙钟、agent step、工具调用和禁用能力四类 guard 约束。guard 触发后 Runner 先调用 `session.cancel` 并收集诊断历史，再无条件停止该题 Host；取消失败也不会把活动会话带到下一题。修改 preset、预算或隔离策略会改变 `comparisonKey`，必须新建 batch，不能续用旧 C0。

运行中按一次 Ctrl+C 会进入优雅中止：当前 turn 收到 `RUN_ABORTED`、执行取消和历史回收、停止 Host，并把 run/batch 标为 `ABORTED`/`interrupted`。中止批次永远不可发布，不会再留下看似仍在运行的 `meta.json`。

## 输出

每个 run 写入 `records/<batch-condition-time>/`。`meta.json` 保存环境、冻结版本和 admission 状态；每题记录保存回答、过程 ledger、URL 检查、Judge 结果和 C0 配对结论。凭据值不会写入记录。
