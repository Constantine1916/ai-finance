## ADDED Requirements

### Requirement: Common chart behavior
系统 SHALL 让每个宏观图表显示序列名称、单位、来源、最新数据日期与可选时间范围（1 年、3 年、5 年、10 年、全部）；来源历史长度不足所选范围时 MUST 说明实际可得范围。

#### Scenario: Limited history
- **WHEN** 用户为 ICE BofA 高收益债利差选择 10 年范围，而来源只提供最近 3 年
- **THEN** 图表显示可得的 3 年数据，并注明来源历史长度限制

#### Scenario: Series stale or pending review
- **WHEN** 图表所用序列过期或存在待确认观测
- **THEN** 图表保留并显示相应标记，不隐藏图表

### Requirement: Rates view
系统 SHALL 提供美债利率视图，包含 3 个月、2 年、5 年、10 年、20 年、30 年期收益率，10Y-2Y 与 10Y-3M 期限利差，10 年期实际利率、10 年期通胀预期、10 年期限溢价与联邦基金有效利率。

#### Scenario: Compare yield curves
- **WHEN** 用户查看收益率曲线
- **THEN** 页面叠加显示最新曲线与 3 个月前、12 个月前的曲线，并标注各自的数据日期

#### Scenario: Inverted spread
- **WHEN** 10Y-3M 利差为负
- **THEN** 图表明确标示倒挂区间及其开始日期

### Requirement: Inflation and commodities view
系统 SHALL 提供 CPI、核心 CPI、核心 PCE 的同比与 3 个月年化变化，5 年后 5 年通胀预期，WTI 与布伦特原油价格，美元广义指数与美国平均电价。

#### Scenario: Show both inflation measures
- **WHEN** 用户查看核心 PCE
- **THEN** 页面同时显示同比与 3 个月年化，并标注各自的计算方式

### Requirement: Credit view
系统 SHALL 提供高收益债与投资级债的期权调整利差，以及高收益债 ETF 与中期国债 ETF 的价格比值作为更长历史的替代指标；替代指标 MUST 标注其不是利差本身。

#### Scenario: Proxy labeling
- **WHEN** 页面显示 HYG/IEF 比值
- **THEN** 图表标题与说明标明这是基于 ETF 价格的替代指标

### Requirement: Growth and employment view
系统 SHALL 提供失业率与萨姆规则、初请失业金 4 周均值、非农就业 3 个月平均新增、工业产出同比、费城联储制造业总体与新订单指数。

#### Scenario: Sahm rule threshold
- **WHEN** 萨姆规则读数达到或超过 0.5
- **THEN** 图表标出阈值线和越过阈值的日期

### Requirement: Liquidity and financial conditions view
系统 SHALL 提供美联储总资产、财政部一般账户、隔夜逆回购余额、由三者计算的净流动性，以及芝加哥联储金融条件指数；净流动性 MUST 标注为经验性指标并公开其公式。

#### Scenario: Different frequencies
- **WHEN** 净流动性所需的周度与日度序列日期不一致
- **THEN** 系统按登记的对齐规则取值，并在图表说明中写明对齐方式

### Requirement: Market and breadth view
系统 SHALL 提供标普 500、纳斯达克综合、纳斯达克 100、罗素 2000、半导体板块与 VIX 的走势；对指数或其 ETF 显示 200 日均线位置、距 52 周高点回撤与 1 个月、3 个月、年初至今涨跌；并提供 IWM/SPY、RSP/SPY、SOXX/SPY 相对强弱与 VIX/VIX3M 期限结构。

#### Scenario: ETF proxy for index
- **WHEN** 罗素 2000 或半导体指数没有免费指数数据而使用 IWM 或 SOXX
- **THEN** 页面标注所用 ETF 代码及其为替代指标

#### Scenario: Adjusted prices
- **WHEN** 计算 ETF 或个股的均线、回撤与涨跌幅
- **THEN** 系统使用拆股与分红调整后的价格，拆股前后数值连续

#### Scenario: Volatility term structure
- **WHEN** VIX/VIX3M 大于 1
- **THEN** 图表标示期限结构倒挂区间
