## ADDED Requirements

### Requirement: US market dashboard
系统 SHALL 提供登录后的美股市场看板，包含美国上市基准 ETF 概览、准确标注范围的热力图、AI 关注池和证券搜索，不提供其他市场入口。

#### Scenario: Open dashboard without optional API keys
- **WHEN** 登录用户在未配置 Finnhub 与 Adanos 的环境打开看板
- **THEN** 页面及可用的 TradingView 组件仍可加载，独立 API 数据显示未配置状态

#### Scenario: Identify heatmap coverage
- **WHEN** 页面展示指定指数或市场范围的 TradingView 热力图
- **THEN** 页面名称与配置的实际覆盖范围一致，不以其他指数名称代替

### Requirement: Traceable US security catalog
系统 SHALL 使用带来源与快照时间的美国上市证券目录提供搜索，排除测试证券，标注交易所与证券类型，并避免搜索输入触发逐次付费或限额 API 调用。

#### Scenario: Search by symbol or name
- **WHEN** 用户输入目录内的股票代码或公司名称片段
- **THEN** 系统从本地目录返回匹配结果，显示代码、名称、交易所和类型，并允许进入详情

#### Scenario: Refresh failure
- **WHEN** 手动更新目录失败但已有有效快照
- **THEN** 系统保留该快照及其真实时间，并明确报告更新失败

#### Scenario: Unsupported input
- **WHEN** 用户提交目录外证券、外国市场代码、加密货币或恶意输入
- **THEN** 系统显示不支持或无匹配，不将其直接透传给供应商

### Requirement: Curated AI universe
系统 SHALL 提供人工维护的 AI 产业链关注池，说明标签来源，不把关注池描述为实时指数成分或投资推荐。

#### Scenario: Navigate from AI universe
- **WHEN** 用户选择关注池中的有效证券
- **THEN** 系统进入同一规范化代码的个股详情，并允许加入个人自选股

#### Scenario: Quote unavailable in universe
- **WHEN** 关注池证券没有可用的独立行情数据
- **THEN** 系统保留证券与标签，行情字段显示原因，不填入演示价格
