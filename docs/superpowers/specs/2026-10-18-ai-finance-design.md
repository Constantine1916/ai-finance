# ai-finance 第一版设计审阅

状态：待用户审阅；本文件不是已批准的实施记录。

## 已确认

- 独立公开仓库 `Constantine1916/ai-finance`，在当前文件夹开发，不使用 GitHub Fork。
- 借鉴 OpenStock 的实现方式，保留美股市场看板、个股详情、自选股、情绪分析。
- 多用户邮箱密码登录，每人独立自选股；免费优先，数据受限明确显示不可用。
- 服务于以数月以上持有为主的美股与 AI 股票研究。

## 本次建议确认的方案

1. **技术与复用**：独立 Next.js 项目，使用 Better Auth / MongoDB，选择性改编上游四模块代码，保留 AGPL-3.0 与来源。TradingView 负责嵌入展示，Finnhub / Adanos 作为可选服务端数据能力。
2. **页面**：默认中文暗色、桌面优先，四个业务导航；AI 关注池按产业链人工维护，市场入口仅美国。个股包括图表、技术、财务、公司信息及情绪摘要。
3. **数据**：免费 key 不自动启用多用户共享展示；没有适用授权时，独立行情与情绪字段保持受限。保留可用嵌入组件，不伪造数据。情绪四源分别展示，不做无依据综合分数。
4. **账户与交付**：自选股最多 50 只，原子更新并验证用户隔离；首版交付本地运行、Docker 和 GitHub 源码。首版不含提醒、AI 邮件、独立新闻、社交登录、密码重置或托管部署。

## 规格入口

以下 OpenSpec 文件为唯一的详细需求来源，本文件只提供审阅摘要，避免两份规格独立演化：

- [需求提案](../../../openspec/changes/build-ai-finance-mvp/proposal.md)
- [技术设计与方案比较](../../../openspec/changes/build-ai-finance-mvp/design.md)
- [账户验收](../../../openspec/changes/build-ai-finance-mvp/specs/accounts/spec.md)
- [市场看板验收](../../../openspec/changes/build-ai-finance-mvp/specs/market-dashboard/spec.md)
- [个股详情验收](../../../openspec/changes/build-ai-finance-mvp/specs/stock-details/spec.md)
- [自选股验收](../../../openspec/changes/build-ai-finance-mvp/specs/watchlists/spec.md)
- [情绪分析验收](../../../openspec/changes/build-ai-finance-mvp/specs/sentiment/spec.md)
- [数据访问验收](../../../openspec/changes/build-ai-finance-mvp/specs/data-access/spec.md)
- [实施任务](../../../openspec/changes/build-ai-finance-mvp/tasks.md)
- [数据源与授权](../../data-sources.md)
- [验证记录](../../verification.md)

本次提交不勾选应用任务。用户审阅确认后，再细化执行计划并进入应用实现。
