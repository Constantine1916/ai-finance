# ai-finance

个人使用的美股宏观与 AI 产业周期看板。把宏观周期、流动性、市场宽度与 AI 硬件产业数据放在一处，每个数值都可追溯来源，辅助中长期的持有与仓位判断。

**当前状态：1A 已部署在 https://finance.aicave.cn（仅所有者登录），处于连续运行观察期；1B 未开始。**

## 第一阶段范围

| 分期 | 模块 | 内容 |
| --- | --- | --- |
| 1A | 宏观看板 | 美债利率与期限利差、实际利率、期限溢价、通胀、原油、美元、信用利差、就业与增长、流动性与金融条件 |
| 1A | 大盘与市场宽度 | 标普 500、纳斯达克、罗素 2000、半导体、VIX；200 日均线、回撤、相对强弱、VIX 期限结构 |
| 1A | 周期信号 | 增长与通胀周期象限；规则公开、阈值可调的信号灯及其历史表现 |
| 1A | 事件日历 | FOMC、CPI、非农、PCE、初请失业金与关注公司财报日 |
| 1B | AI 产业周期 | 云厂商资本开支、台积电月营收、韩国半导体出口、分层关注池、财报基本面、估值与周期股视图 |

时效性优先：宏观数据在官方发布后尽快采集；美股交易时段内，关注池与大盘 ETF 每 5 分钟更新一次盘中快照，标为暂定，收盘后以收盘价确认。数据统一存入本地时间序列库，页面不直接调用供应商。AI 关注池可以随时在页面上增减。缺失、待确认、过期与修订都明确标出，不用演示数据或估算值填补。信号只是规则判断，不生成综合评分或买卖指令。

第一阶段不含多用户、自选股、情绪分析、推送提醒、分析师一致预期、盘中行情、交易与持仓功能。

## 规格与开发方式

采用 OpenSpec 的 SDD 流程：需求场景 → 技术设计 → 实施任务 → 实现与验证 → 归档。规格检查通过不代表功能已实现。

- [设计审阅入口](docs/superpowers/specs/2026-10-25-ai-finance-macro-design.md)
- [需求提案](openspec/changes/build-ai-finance-mvp/proposal.md)
- [技术设计](openspec/changes/build-ai-finance-mvp/design.md)
- [六项能力的验收规格](openspec/changes/build-ai-finance-mvp/specs/)
- [实施任务](openspec/changes/build-ai-finance-mvp/tasks.md)
- [数据源与授权边界](docs/data-sources.md)
- [验证记录](docs/verification.md)

规格校验（OpenSpec CLI 固定为 1.14.3，已在 Node.js 22 与 24 上运行）：

```sh
OPENSPEC_TELEMETRY=0 OPENSPEC_NO_UPDATE_CHECK=1 npx --yes @fission-ai/openspec@1.14.3 validate build-ai-finance-mvp --strict
```

采用 Next.js 16、TypeScript 6、PostgreSQL 17 与 Drizzle、ECharts，在自有 VPS 上以 pm2（web 与 worker）和 cron 运行，经 Nginx 部署在 `finance.aicave.cn`。

## 本地运行

需要 Node.js 22.12 以上与 Docker。

```sh
cp .env.example .env               # 填写数据库密码、会话密钥与各数据源密钥
npx --yes npm@11.21.0 ci
npm run db:up && npm run db:migrate
npm run dev                        # http://127.0.0.1:3020
```

提交前运行 `npm run typecheck && npm run lint && npm run test && npm run build`。

## 部署（VPS）

| 组件 | 方式 |
| --- | --- |
| 网站与采集进程 | pm2：`ai-finance-web`（127.0.0.1:3020）、`ai-finance-worker`，定义见 `deploy/ecosystem.config.cjs` |
| 反向代理 | Nginx 站点 `deploy/nginx-finance.aicave.cn.conf`，安装为 `/etc/nginx/conf.d/ai-finance.conf` |
| 证书 | acme.sh（阿里云 DNS 验证，ECC），安装到 `/etc/nginx/ssl/finance.aicave.cn/`，随 acme.sh 每日任务自动续期 |
| 数据库 | Docker 容器 `ai-finance-postgres`（127.0.0.1:5434） |
| 定时任务 | 系统 cron：每日 03:30 `deploy/backup.sh`（保留 14 份，`/root/backups/ai-finance/`）；每 5 分钟 `deploy/check-worker.sh`（心跳超过 5 分钟则重启 worker） |

更新部署：`./deploy/deploy.sh`（拉取、安装、迁移前备份、迁移、构建、`pm2 reload`）。

## 开源与来源

本项目使用 [AGPL-3.0](LICENSE)，参考 [OpenStock](https://github.com/Open-Dev-Society/OpenStock) 的部分实现，复用范围与来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本仓库不是 OpenStock 官方产品。FRED 中由 S&P、Nasdaq、ICE 等第三方持有版权的序列只在私有部署中供个人使用；数据服务与 TradingView 组件各自的条款不因代码开源而改变。
