# ai-finance

个人使用的美股宏观与 AI 产业周期看板。把宏观周期、流动性、市场宽度与 AI 硬件产业数据放在一处，每个数值都可追溯来源，辅助中长期的持有与仓位判断。

**当前状态：规格设计阶段，等待用户审阅。尚无应用代码，不能启动看板。**

## 第一阶段范围

| 分期 | 模块 | 内容 |
| --- | --- | --- |
| 1A | 宏观看板 | 美债利率与期限利差、实际利率、期限溢价、通胀、原油、美元、信用利差、就业与增长、流动性与金融条件 |
| 1A | 大盘与市场宽度 | 标普 500、纳斯达克、罗素 2000、半导体、VIX；200 日均线、回撤、相对强弱、VIX 期限结构 |
| 1A | 周期信号 | 增长与通胀周期象限；规则公开、阈值可调的信号灯及其历史表现 |
| 1A | 事件日历 | FOMC、CPI、非农、PCE、初请失业金与关注公司财报日 |
| 1B | AI 产业周期 | 云厂商资本开支、台积电月营收、韩国半导体出口、分层关注池、财报基本面、估值与周期股视图 |

数据为日线及更低频率，每日批量采集后存入本地时间序列库，页面不直接调用供应商。缺失、待确认、过期与修订都明确标出，不用演示数据或估算值填补。信号只是规则判断，不生成综合评分或买卖指令。

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

拟采用 Next.js App Router、TypeScript、SQLite 与 Drizzle、ECharts，在自有 VPS 上以 pm2 与 cron 运行。技术方案批准后再固定依赖版本。

## 开源与来源

本项目使用 [AGPL-3.0](LICENSE)，参考 [OpenStock](https://github.com/Open-Dev-Society/OpenStock) 的部分实现，复用范围与来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本仓库不是 OpenStock 官方产品。FRED 中由 S&P、Nasdaq、ICE 等第三方持有版权的序列只在私有部署中供个人使用；数据服务与 TradingView 组件各自的条款不因代码开源而改变。
