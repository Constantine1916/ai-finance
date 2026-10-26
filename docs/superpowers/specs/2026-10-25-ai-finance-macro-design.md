# ai-finance 第一阶段设计审阅

状态：待用户审阅；本文件不是已批准的实施记录。替代 2026-10-18 的多用户四模块草案（见 git 历史）。

## 已确认

- 第一阶段只供用户本人使用，私有部署在自有 VPS，不开放注册。
- 目标：用宏观周期、流动性、市场宽度与 AI 硬件产业周期的数据，辅助中长期持有与仓位判断。
- 看板分层：AI 产业周期 → 盈利与估值 → 宏观与流动性 → 市场宽度与情绪；第一阶段覆盖免费可得的部分。
- 存储等强周期股单独提供周期股视图。
- 信号公开规则与历史表现，不做综合评分或买卖指令，仓位由用户决定；采用默认阈值。
- 分期：1A 宏观、大盘、信号、事件日历；1B AI 产业周期与周期股视图。
- 时效性优先：官方数据发布后尽快采集；交易时段内提供盘中快照，标为暂定。
- AI 关注池可在页面上随时增减与调整。
- 技术栈：PostgreSQL、全栈 TypeScript、pm2 与 cron，经 Nginx 部署在 `finance.aicave.cn`（DNS 已解析）。
- OpenStock 只作有限参考：Finnhub 报价用法、TradingView 组件容器与 EDGAR 访问方式。

## 待确认

1. 日线行情：注册 Tiingo 免费密钥后核实额度与条款（Finnhub 免费档已实测不提供历史 K 线）。

## 规格入口

以下 OpenSpec 文件为唯一的详细需求来源，本文件只提供审阅摘要：

- [需求提案](../../../openspec/changes/build-ai-finance-mvp/proposal.md)
- [技术设计](../../../openspec/changes/build-ai-finance-mvp/design.md)
- [数据管道](../../../openspec/changes/build-ai-finance-mvp/specs/data-pipeline/spec.md)
- [访问保护](../../../openspec/changes/build-ai-finance-mvp/specs/access-control/spec.md)
- [宏观看板](../../../openspec/changes/build-ai-finance-mvp/specs/macro-dashboard/spec.md)
- [周期信号](../../../openspec/changes/build-ai-finance-mvp/specs/cycle-signals/spec.md)
- [事件日历](../../../openspec/changes/build-ai-finance-mvp/specs/event-calendar/spec.md)
- [AI 产业周期](../../../openspec/changes/build-ai-finance-mvp/specs/ai-industry/spec.md)
- [实施任务](../../../openspec/changes/build-ai-finance-mvp/tasks.md)
- [数据源与授权](../../data-sources.md)
- [验证记录](../../verification.md)

用户确认待确认项并批准规格后，再固定依赖版本并进入 1A 实现。
