# CLAUDE.md

项目约定以 AGENTS.md 为准（Codex 与 Claude Code 共用），这里只补充 Claude Code 的工作方式。两份文件冲突时，以 AGENTS.md 为准，并提醒用户同步。

@AGENTS.md

## 当前状态

- 规格已于 2026-10-26 获用户批准，正在实现 1A。进度以 `openspec/changes/build-ai-finance-mvp/tasks.md` 的勾选情况为准。
- 第一阶段是个人使用的宏观与 AI 产业看板，旧的多用户四模块草案已被替换（见 git 历史）。
- 修改规格时同时遵守 `openspec/config.yaml` 中的 `rules`。

## 常用命令

依赖安装必须用 `package.json` 中 `packageManager` 固定的 npm 11（全局 npm 10.9.4 解析 Vitest 依赖时会崩溃）：

```sh
npx --yes npm@11.21.0 ci          # 安装依赖；npm 11 默认拦截依赖的安装脚本，esbuild 与 Argon2 无需这些脚本
npm run db:up                      # 启动 PostgreSQL 容器（127.0.0.1:5434），需要 .env 中的 POSTGRES_PASSWORD
npm run db:migrate                 # 应用 drizzle/ 中的迁移
npm run db:generate -- --name <名称>  # 修改 src/db/schema.ts 后生成迁移
npm run dev                        # 开发服务器 http://127.0.0.1:3020
npm run worker                     # 采集调度器（目前只写心跳）
npm run typecheck && npm run lint && npm run test && npm run build   # 提交前四项检查
npm run check:secrets -- .next     # 扫描构建产物中是否出现 .env 里的密钥值
npm run hash-password              # 生成 OWNER_PASSWORD_HASH
```

运行配置放在仓库根目录 `.env`（权限 600，已被 .gitignore 排除），模板见 `.env.example`。密钥绝不提交。

规格校验（OpenSpec CLI 固定 1.14.3，通过 npx 使用，不全局安装）：

```sh
OPENSPEC_TELEMETRY=0 OPENSPEC_NO_UPDATE_CHECK=1 npx --yes @fission-ai/openspec@1.14.3 validate build-ai-finance-mvp --strict
```

## 提交前检查

提交邮箱必须是 `constantine1916@foxmail.com`，姓名不限。`.git/config` 不随克隆传递；有效邮箱不是它时，先执行 `git config user.email constantine1916@foxmail.com`。每次提交前确认：

```sh
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
git diff --cached --check
```

两项身份的邮箱都必须是 `constantine1916@foxmail.com`；否则停止提交并告知用户。

## 记录

- 检查结果写入 `docs/verification.md`，按日期分节，区分通过、失败与未执行。
- 新增或改编外部源码时同步更新 `THIRD_PARTY_NOTICES.md`。
- 本文件随项目阶段变化更新（例如实现开始后补充构建、测试、启动命令）。
