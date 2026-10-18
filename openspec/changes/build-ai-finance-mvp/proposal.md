## Why

用户需要一套面向数月以上持有周期的美股与 AI 股票研究看板，希望借鉴 OpenStock 的成熟组件组织方式，同时只保留四个业务模块。独立新仓可以明确范围、清理不需要的任务与供应商依赖，并用可验收规格约束实现。

用户已经确认：多用户邮箱密码登录、独立自选股、免费优先、受限制数据明确不可用，以及公开的 `Constantine1916/ai-finance` 仓库。当前提交用于审阅方案，不表示应用已实现。

## What Changes

- 建立美股市场概览、证券搜索与 AI 关注池。
- 通过 TradingView 嵌入提供个股图表、技术、财务和公司信息。
- 实现账户隔离的 MongoDB 自选股，最多 50 只，并约束并发写入。
- 接入 Adanos 四类情绪源，提供来源、时间、覆盖与失败状态。
- 为 Finnhub / Adanos 统一设置授权门槛、服务端缓存、配额与错误模型；无密钥也能访问基础界面和可用的公开嵌入组件。
- 建立规格、实现、验证、来源追踪和后续归档流程。

第一版不包含其他市场、交易执行、持仓收益、价格提醒、Inngest 定时任务、AI 邮件、新闻独立板块、社交登录、密码重置或付费数据采购。财务深度研究、估值模型与量化选股属于后续需求。

## Capabilities

### New Capabilities

- `accounts`: 邮箱密码注册、登录、退出及服务端访问控制。
- `market-dashboard`: 美股市场概览、AI 关注池、证券目录搜索。
- `stock-details`: 统一证券路由与 TradingView 个股组件。
- `watchlists`: 用户独立持久化、去重、删除与原子上限。
- `sentiment`: 四类 Adanos 数据、来源状态与部分可用展示。
- `data-access`: 供应商适配、授权开关、缓存、配额和安全边界。

### Modified Capabilities

无；这是独立仓库的第一项变更。

## Impact

技术方向为 Next.js、TypeScript、Better Auth、MongoDB、TradingView，以及可选的 Finnhub / Adanos；接口与存储约束见设计文档。采用 AGPL-3.0 并记录上游来源。需要 MongoDB 才能完整使用账户与自选股；供应商真实调用取决于密钥、额度、适用授权与网络。首版交付目标为本地运行、Docker 与公开 GitHub 源码，不包含托管部署。
