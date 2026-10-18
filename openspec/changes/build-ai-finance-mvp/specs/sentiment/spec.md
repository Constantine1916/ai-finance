## ADDED Requirements

### Requirement: Four source sentiment view
系统 SHALL 为所选证券提供 Reddit、X、新闻与 Polymarket 四个 Adanos 来源的情绪视图，默认 7 天并支持 1 天与 30 天窗口。

#### Scenario: Load available sources
- **WHEN** 用户选择有效证券和支持的窗口，且授权、密钥、配额与来源数据可用
- **THEN** 系统按来源展示供应商实际返回的指标、单位、时间与所选窗口

#### Scenario: Change time window
- **WHEN** 用户从 7 天切换到 30 天
- **THEN** 系统使用新窗口的独立缓存或请求，不把 7 天结果标注为 30 天

### Requirement: Partial source availability
系统 SHALL 独立处理各来源的成功、空样本、无覆盖、限流与失败，不因一个来源失败而丢弃其他来源。

#### Scenario: One source fails
- **WHEN** 四个来源中一个失败，其他来源成功
- **THEN** 系统展示成功来源及失败来源的明确状态，不把失败来源计为零

#### Scenario: No observations
- **WHEN** 供应商返回无讨论或无有效样本
- **THEN** 系统显示样本不足，不将其解释为中性情绪或生成看涨比例

### Requirement: Honest sentiment interpretation
系统 SHALL 保留来源指标含义，不混同讨论量与交易数，不生成无依据的跨源平均分、置信度或买卖信号。

#### Scenario: Different source units
- **WHEN** 来源分别返回讨论量和预测市场交易数
- **THEN** 页面分别标注单位，不直接相加为统一讨论量

#### Scenario: Missing bullish percentage
- **WHEN** 来源没有有效看涨比例字段
- **THEN** 页面只显示已有指标，不从其他指标推算虚构比例

### Requirement: Visible unavailable states
系统 SHALL 在未配置、授权受限或预算耗尽时保留情绪板块并解释状态，而不是隐藏板块。

#### Scenario: Missing configuration or permission
- **WHEN** 没有 Adanos 密钥或未启用适用的共享展示配置
- **THEN** 情绪页与个股摘要显示相应原因，不发起 Adanos 调用

#### Scenario: Monthly budget exhausted
- **WHEN** 本实例集群已经达到配置的 Adanos 月预算
- **THEN** 系统停止新调用，显示限流或预算状态，只在仍被授权且有明确过期标识时展示已有缓存
