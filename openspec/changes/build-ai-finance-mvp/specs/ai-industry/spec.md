## ADDED Requirements

### Requirement: Curated layered AI hardware universe
系统 SHALL 提供由用户维护的 AI 硬件关注池，按产业链分层（算力芯片、代工与设备、存储、服务器、网络与光模块、电力与散热），并标注每只证券的周期强度分类；页面 MUST 说明分层与分类为人工标签，不是指数成分或投资推荐。

#### Scenario: View the universe
- **WHEN** 用户打开 AI 产业页面
- **THEN** 页面按层列出证券及其 1 个月、3 个月、年初至今涨跌，相对 SOXX 与 SPY 的强弱，以及 200 日均线位置

#### Scenario: Edit the universe
- **WHEN** 用户新增一只证券但其代码无法在行情来源或 SEC 登记中找到
- **THEN** 系统拒绝添加并说明原因

### Requirement: Filing based fundamentals
系统 SHALL 从 SEC 申报数据计算关注池公司的单季营收、营收同比、毛利率、营业利润率、存货、存货天数、资本开支与研发费用；每个数值 MUST 链接到对应申报文件。

#### Scenario: Year-to-date values in quarterly filings
- **WHEN** 季报给出的是年初至今累计值
- **THEN** 系统用相邻期相减得到单季值，第四季度用年报减去前三季度，并使四个单季合计等于年报数值

#### Scenario: Concept name changes
- **WHEN** 公司在不同年份用不同的会计科目名称申报同一指标
- **THEN** 系统按该公司登记的科目映射取值；没有映射的期间显示缺失，而不是改用其他公司的数值

#### Scenario: Restated figures
- **WHEN** 新申报重述了以前期间的数值
- **THEN** 系统以最新申报为当前值，并保留重述前的数值与申报编号

#### Scenario: Foreign filer
- **WHEN** 公司只提交年度 20-F，以新台币等非美元货币报告
- **THEN** 系统标注报告频率与币种，不把其年度数值当作季度值，也不与美元数值直接相加

### Requirement: AI demand indicators
系统 SHALL 汇总微软、谷歌、亚马逊、Meta 与甲骨文的季度资本开支，显示合计值、同比增速及增速变化；不同财年的公司 MUST 按登记规则对齐到日历季度。云业务收入增速等未进入结构化申报的数据通过人工录入提供。

#### Scenario: Fiscal year alignment
- **WHEN** 合计包含财年于 6 月结束的微软与财年于 5 月结束的甲骨文
- **THEN** 系统按登记的对齐规则把各期归入日历季度，并在图表说明中列出各公司的对齐方式

#### Scenario: Incomplete quarter
- **WHEN** 某日历季度仍有公司未发布财报
- **THEN** 该季度合计标为不完整并列出缺少的公司，不与完整季度直接比较

### Requirement: AI supply and leading indicators
系统 SHALL 提供台积电月营收及其同比与 3 个月平均同比、韩国半导体出口（全月与前 20 天）、美国半导体与电子元件工业产出。

#### Scenario: TSMC monthly revenue cross-check
- **WHEN** 台积电官网月营收与对应 6-K 申报的数值不一致
- **THEN** 该观测标为待确认，直到用户核实

#### Scenario: Partial month exports
- **WHEN** 只有当月前 20 天的韩国出口数据
- **THEN** 页面把它标为前 20 天数据，不与全月数据混在同一序列

### Requirement: Cyclical stock view
系统 SHALL 为标为强周期的证券（如存储与半导体设备）提供周期股视图：毛利率与存货天数的历史走势、市净率及其历史区间、存储现货与合约价格（人工录入）、存储厂资本开支指引（人工录入）；视图 MUST 说明周期股不宜用市盈率判断贵贱。

#### Scenario: View memory cycle
- **WHEN** 用户打开美光的周期股视图
- **THEN** 页面显示毛利率、存货天数与市净率的历史位置，以及已录入的存储价格与来源

#### Scenario: Memory price not entered
- **WHEN** 最近一期存储价格尚未人工录入
- **THEN** 页面显示最后录入日期与过期标记，不沿用旧价格冒充最新

### Requirement: Valuation metrics
系统 SHALL 根据申报数据与复权价格计算滚动 12 个月市盈率与市净率，并显示其历史区间；亏损期间 MUST 显示不适用，而不是负市盈率。

#### Scenario: Negative earnings
- **WHEN** 公司滚动 12 个月每股收益为负
- **THEN** 市盈率显示不适用及原因，市净率照常计算

#### Scenario: Forward estimates unavailable
- **WHEN** 用户查找远期市盈率或盈利预期修正
- **THEN** 页面说明这些需要付费的分析师一致预期数据，第一阶段不提供

### Requirement: Stock detail page
系统 SHALL 为关注池中的每只证券提供详情页，包括 TradingView 嵌入的 K 线、本系统存储的基本面与估值序列、最近的申报文件链接；嵌入组件 MUST 保留 TradingView 标识，且其中的数据不被本系统提取或用于计算。

#### Scenario: Embedded chart fails to load
- **WHEN** TradingView 脚本被阻止或加载超时
- **THEN** 页面显示失败提示与外部查看链接，本系统的基本面图表照常显示

#### Scenario: Symbol outside the universe
- **WHEN** 用户访问不在关注池中的证券详情路径
- **THEN** 页面显示未收录，不向供应商请求该代码
