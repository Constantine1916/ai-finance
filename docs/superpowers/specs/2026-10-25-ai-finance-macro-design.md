# ai-finance 第一阶段设计审阅

状态：待用户审阅；本文件不是已批准的实施记录。替代 2026-10-18 的多用户四模块草案（见 git 历史）。

## 已确认

- 第一阶段只供用户本人使用，私有部署在自有 VPS，不开放注册。
- 目标：用宏观周期、流动性、市场宽度与 AI 硬件产业周期的数据，辅助中长期持有与仓位判断。
- 看板分层：AI 产业周期 → 盈利与估值 → 宏观与流动性 → 市场宽度与情绪；第一阶段覆盖免费可得的部分。
- 存储等强周期股单独提供周期股视图。
- 信号公开规则与历史表现，不做综合评分或买卖指令，仓位由用户决定。
- 分期：1A 宏观、大盘、信号、事件日历；1B AI 产业周期与周期股视图。
- OpenStock 只作有限参考：TradingView 组件容器与 EDGAR 访问方式。

## 待审阅的技术默认方案

1. **架构**：每日批量采集入库，页面只读本地数据，不在打开页面时调用供应商。
2. **技术栈**：Next.js App Router + TypeScript 全栈；SQLite（WAL）+ Drizzle；ECharts；Tailwind。
3. **数据源**：FRED API、SEC EDGAR、日线行情（默认 Tiingo 免费档，额度待核实）、台积电月营收；存储价格、云业务增速等人工录入。
4. **访问保护**：单一所有者用户名与 Argon2id 密码哈希，签名会话 Cookie，登录限流。
5. **部署**：pm2 运行应用，系统 cron 调度采集，经反向代理提供 HTTPS，每日备份数据库。

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

用户审阅确认后，再固定依赖版本并进入 1A 实现。
