# CLAUDE.md

项目约定以 AGENTS.md 为准（Codex 与 Claude Code 共用），这里只补充 Claude Code 的工作方式。两份文件冲突时，以 AGENTS.md 为准，并提醒用户同步。

@AGENTS.md

## 当前状态

- 仓库只有规格文档，没有应用代码。状态以 `openspec/changes/build-ai-finance-mvp/tasks.md` 的勾选情况为准。
- 2026-10-25 起第一阶段改为个人使用的宏观与 AI 产业看板，旧的多用户四模块草案已被替换（见 git 历史）。
- 规格未经用户批准前，不创建应用骨架、不安装依赖。
- 修改规格时同时遵守 `openspec/config.yaml` 中的 `rules`。

## 常用命令

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
