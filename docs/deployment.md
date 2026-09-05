# 生产发布约定

目标结构为 DSH-Eval 根首页 `/`、Top100 子栏目 `/top100/`，两者共用 Caddy 入口和 `dsh-top100_default` 网络。本文描述待发布配置，不代表线上已切换。首次路径迁移必须协调两个站点和网关；迁移完成后的日常评测站更新才只替换 `dsh-eval-web`。部署不运行评测或数据采集。

## 首次首页迁移

两个仓库分别完成 PR、检查和合并后，再经明确授权发布；不要只发布其中一个站点或提前更新公开入口。

| 路径 | 所属服务 |
| --- | --- |
| `/`、`/results/...`、`/methodology/...`、`/faq` | DSH-Eval |
| `/eval-data/...` | DSH-Eval 的公开评测下载 |
| `/robots.txt`、`/sitemap.xml` | DSH-Eval；robots 同时列出 Top100 sitemap |
| `/top100/` 及其子路径 | 网关剥掉 `/top100` 前缀后交给 Top100 |
| `/data`、`/data/...`、`/api/events` | Top100；包含 `www` 域名的旧客户端接口 |
| `/assets/...` | Top100 的历史图片链接兼容 |

1. 记录两个现有镜像、发布提交及网关配置，保留可恢复的整组旧版本。构建两个候选站点，使用独立网络和仅环回可访问的端口联合验收。
2. 使用 `deploy/Caddyfile` 的路由配置：裸域作为标准页面域名；`www` 页面跳到裸域，但已有 `/data/...` 与 `/api/events` 请求直接代理，避免给旧插件增加跨域跳转。Caddy 需要支持 `http.request.uri.prefixed_query`（2.9 或更新），切换前运行配置验证。
3. `/dsheval/...` 以 308 跳到对应根路径；其中 `/dsheval/data/...` 跳到 `/eval-data/...`。`/top100` 补尾斜杠。旧独立 Top100 HTML 页面跳到 `/top100` 下同名页面，保留查询参数。
4. `public/legacy-top100.js` 在根首页识别旧 `?page=dsh`、`?page=docs`、榜单筛选参数及 `#ranking` 等片段，保留状态进入 Top100。纯根首页链接无法区分旧意图，因此首页持续提供 Top100 导航。旧评测页面的 `#about` 留在主站。
5. 在同一次发布窗口协调切换两个站点和网关，运行 `scripts/smoke-production.mjs` 验收评测服务，再对统一网关运行 `scripts/smoke-migration.mjs`。核对旧榜单数据、安装指南、Skills、下载文件、搜索地图、查询参数与跳转循环；两侧 `/api/events` 不写入网关访问日志。
6. 新路径上线验证通过后，同步 GitHub About、Website、组织主页与两个仓库 README；Top100 的 npm 简介、homepage、README 和插件内链接随新版本发布。包名及安装方式保持不变，版本号按发布时实际状态确定。外部更新不由本地修改自动执行。

若联合验收或切换失败，恢复两个旧镜像及旧网关配置，按旧地址结构验证，不能只回滚一个组件。

路由语义参考：[Caddy handle_path](https://caddyserver.com/docs/caddyfile/directives/handle_path)、[Caddy redir](https://caddyserver.com/docs/caddyfile/directives/redir)。独立 Sites 预览仅包含评测应用；本次两个服务共用域名的迁移以统一网关为准。

迁移上线后的 GitHub 对外信息使用以下内容；这里只准备文案，不修改远端设置：

| 入口 | 简介 | Website |
| --- | --- | --- |
| `dsheval/dsh-eval` | 面向 DSH Agent 与插件的公开评测平台，公开真实任务中的表现、方法与证据。 | `https://dsheval.ai/` |
| `dsheval/dsh-top100` | DSH-Eval 旗下的插件与 Skills 发现栏目，按公开 GitHub 信号持续更新。 | `https://dsheval.ai/top100/` |
| GitHub 组织主页（如已配置） | DSH-Eval：公开评测与插件发现。 | 主入口 `/`，Top100 入口 `/top100/` |

## 发布来源与检查

固定流程：功能分支 → GitHub PR → 检查与审查 → 合并 `main` → 确认合并提交 CI 通过 → 经授权在服务器发布该提交。

- 不从未合并分支发布生产，不用本地源码压缩包替换正式工作目录。
- `.github/workflows/ci.yml` 检查依赖安全、lint、类型、三个评测套件、应用构建、Compose 配置和完整容器。CI 只做验证，不持有服务器凭证，也不自动部署。功能改动由 PR 触发检查，主分支 push 再验证合并提交；同一分支的新提交会取消旧检查。
- npm 审计必须检查完整依赖树；部分 `devDependencies` 会进入服务端构建。任何 high / critical 漏洞或审计异常都需要先处理，不能跳过。安装使用 `--no-audit` 避免隐式重复审计，随后明确执行完整审计；每个审计请求最多等待 5 分钟、重试 1 次，服务不可用时仍阻断发布。CI 每轮独立审计一次，Dockerfile 不重复审计；手动发布必须确认目标提交的审计已通过。
- 应用只在 Docker 构建阶段编译一次，随后验收该镜像。Buildx 使用 GitHub Actions 缓存复用镜像层；缓存不替代每轮独立审计、测试和容器验收，也不会推送镜像。
- `scripts/smoke-production.mjs` 验证八个页面、生产 JS/CSS、品牌图标、公开结果 JSON 与 sitemap。必须对完整 Nginx + Node 服务运行，不能只对裸 Vinext 端口运行。
- `node --test scripts/test-legacy-links.mjs` 验证旧链接片段和参数兼容；`scripts/smoke-migration.mjs` 对独立联合网关或已授权发布后的公网执行只读迁移验收。
- 本机缺少 Deep Research 私有题集时，对应测试会跳过，不能将其写成已通过。私有题集及任何秘密不得上传 GitHub 或 CI。

## 服务器目录边界

| 位置 | 内容 |
| --- | --- |
| `/opt/dsh-eval/app` | 干净的 Git 工作目录，远端为 `https://github.com/dsheval/dsh-eval.git`，正常运行时位于 `main` |
| `/opt/dsh-eval-state/compose.production.yml` | 主机专用 Compose 覆盖配置 |
| `/opt/dsh-eval-state/backups/` | 迁移前源码和后续回滚记录 |
| `/opt/dsh-eval-state/releases/` | 发布提交、镜像、时间与验收结果记录 |

当前 DSHEval 服务不挂载数据库，也不需要应用密钥。公开评测快照随源码发布。将来如需凭证或运行数据，应放在 state 目录并单独管理，不放入工作目录、不创建指向秘密的仓库内软链接。不要读取或迁移 Top100 的 state。

首次配置时，从 `docker/compose.server.example.yml` 创建 state 中的生产覆盖文件；后续更新保留服务器配置，不自动覆盖。历史备份 `/opt/dsh-eval/backups/` 继续保留，不因目录迁移而删除。

## 更新已有 Git 部署

操作前确认 GitHub 上目标 PR 已合并、目标 `main` 提交的 CI 成功，以及当前发布确实得到授权。若有并行发布、工作树不干净或版本与预期不同，停止，不做 reset 或强制覆盖。

在服务器的 Bash 会话中准备代码和配置：

```bash
set -euo pipefail
cd /opt/dsh-eval/app
test "$(sudo -n git branch --show-current)" = main
test -z "$(sudo -n git status --porcelain)"
previous_revision=$(sudo -n git rev-parse HEAD)
previous_image=$(sudo -n docker inspect --format '{{.Image}}' dsh-eval-web)
release_stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo -n docker tag "$previous_image" "dsh-eval-web:rollback-$release_stamp"

sudo -n git pull --ff-only origin main
release_revision=$(sudo -n git rev-parse HEAD)
test "$release_revision" = "$(sudo -n git rev-parse origin/main)"
test -z "$(sudo -n git status --porcelain)"

compose=(sudo -n docker compose -p dsh-eval
  -f /opt/dsh-eval/app/compose.production.yml
  -f /opt/dsh-eval-state/compose.production.yml)
"${compose[@]}" config --quiet
sudo -n docker build --label "org.opencontainers.image.revision=$release_revision" \
  -t "dsh-eval-web:$release_revision" .
```

记录 `previous_revision`、`previous_image`、回滚镜像标签和 `release_revision` 到 state 的发布记录中。先用候选镜像启动仅本机可访问的独立容器，执行 `scripts/smoke-production.mjs`；镜像构建和验收失败都不能切换生产。只在候选验收通过后执行：

```bash
sudo -n docker tag "dsh-eval-web:$release_revision" dsh-eval-web:latest
"${compose[@]}" up -d --no-build --force-recreate web
"${compose[@]}" ps
sudo -n docker exec -i dsh-eval-web node --input-type=module < scripts/smoke-production.mjs
```

发布完成必须同时确认：

1. 容器为 `healthy`，镜像 revision 标签与预定发布提交相同。
2. `git status --porcelain` 为空；HEAD 位于 `main` 且与目标远端提交一致。
3. 八页、JS/CSS、品牌图标、JSON、sitemap 及公网 HTTPS 可用。
4. Top100 与网关保持运行；清理本次独立候选容器，不删除回滚镜像和备份。

容器使用 `json-file` 日志驱动，单文件上限 10 MB，最多保留 3 个文件。发布后检查容器日志配置是否生效；这不替代发布记录和回滚镜像。

## 失败与回滚

构建或候选验收失败时，旧容器仍应保持运行；不要为了使 Git 看起来一致就替换服务。记录当前源码与线上版本的差异，修复或回到上次已发布提交。

切换后的健康检查失败时，使用记录的旧镜像恢复服务，并将干净的工作目录切回 `previous_revision`（`git switch --detach`）。使用原来的 state 配置，不覆盖生产配置，也不删除旧源码备份。回滚后重新验收，并明确记录当前为 detached 状态；问题解决后再返回经过检查的 `main`。

旧镜像可能含已修复的依赖漏洞，回滚只作为恢复可用性的应急措施，不能把旧版本视为长期安全基线。清理历史目录或镜像需另行确认保留策略。
