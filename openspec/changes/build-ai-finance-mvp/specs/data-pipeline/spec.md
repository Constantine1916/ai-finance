## ADDED Requirements

### Requirement: Traceable observations
系统 SHALL 为每个数据点保存来源、来源内的序列或文件标识、单位、数据日期、抓取时间和可点击的原始链接；财报数据还 MUST 保存申报编号与表单类型。页面展示的每个数值都能追溯到这些信息。

#### Scenario: Inspect a value
- **WHEN** 用户在看板上查看某个数值的来源
- **THEN** 页面显示来源名称、序列或申报编号、数据日期、抓取时间和原始链接，原始链接指向供应商或监管机构的页面

#### Scenario: Data date differs from fetch time
- **WHEN** 数据日期为前一交易日或上月，而抓取发生在今天
- **THEN** 页面分别显示数据日期与抓取时间，不把抓取时间标为数据时间

### Requirement: Scheduled idempotent ingestion
系统 SHALL 按每个序列的发布频率定时采集，并在主要数据发布日追加采集；重复运行同一任务 MUST 得到相同的存储结果，失败的任务不得删除或覆盖已有的有效数据。

#### Scenario: Daily run after US market close
- **WHEN** 美东收盘后的每日任务运行
- **THEN** 日度序列写入最新可得的观测值，已存在且未变化的观测不产生重复记录

#### Scenario: Upstream failure
- **WHEN** 供应商超时、返回错误或限流
- **THEN** 任务在有限次数内重试后记为失败，保留上一份有效数据，并在任务健康状态中显示失败原因

#### Scenario: Missing API key
- **WHEN** 某个需要密钥的来源未配置密钥
- **THEN** 该来源的任务不发出请求，相关序列显示未配置，其他来源照常采集

### Requirement: Timeliness targets
系统 SHALL 为每个序列登记时效目标：官方数据在预定发布时间后持续追加采集，直到取得新观测或达到配置的等待上限；美股交易时段内按配置间隔采集关注池与大盘 ETF 的盘中快照。页面 MUST 显示每个数值距今的时间。

#### Scenario: CPI release
- **WHEN** CPI 的官方发布时间到达
- **THEN** 系统按配置间隔请求官方来源，取得新观测后停止追加；正常情况下发布后 15 分钟内页面可见

#### Scenario: Release delayed
- **WHEN** 达到等待上限仍没有新观测
- **THEN** 系统停止追加，把相关序列标为延迟，并在日程中显示数据未到达

#### Scenario: Intraday snapshot
- **WHEN** 美股交易时段内页面显示某 ETF 的价格
- **THEN** 价格标为盘中暂定，显示快照时间与供应商时间戳；盘中快照不写入日线历史，收盘后以复权收盘价为正式值

#### Scenario: Earlier official source
- **WHEN** 同一指标有比 FRED 更早发布的官方来源，例如财政部收益率曲线
- **THEN** 系统先用更早的来源，FRED 到达后交叉核对，不一致时标为待确认

#### Scenario: Request budget exceeded
- **WHEN** 新的配置会让盘中快照的请求量超过供应商额度的安全上限
- **THEN** 系统拒绝保存该配置并说明原因，不超额请求

### Requirement: Validation before display
系统 SHALL 在数据入库后、展示前执行范围、跳变、连续性、单位与币种检查；未通过检查的观测 MUST 标为待确认，不能作为正常数据展示或参与信号计算。

#### Scenario: Out of range value
- **WHEN** 国债收益率观测值超出该序列配置的合理范围
- **THEN** 该观测标为待确认，页面显示上一个通过检查的值并提示存在待确认数据

#### Scenario: Abnormal jump
- **WHEN** 单期变化超过该序列历史波动配置的倍数
- **THEN** 该观测标为待确认，直到用户确认或下一次采集得到一致结果

#### Scenario: Unit mismatch
- **WHEN** 计算需要组合单位不同的序列，例如百万美元与十亿美元
- **THEN** 系统先按登记的单位换算再计算；单位未登记时拒绝计算并显示原因

#### Scenario: Gap in trading days
- **WHEN** 日度序列相对交易日历缺少观测
- **THEN** 系统记录缺口，图表在缺口处断开或标记，不以零或上一值悄悄填补

### Requirement: Revisions and vintages
系统 SHALL 对会被事后修订的序列保留修订记录；页面默认显示最新值，并在值被修订时可查看修订前后的数字。

#### Scenario: Payroll revision
- **WHEN** 新一次采集得到的上月非农数值与已存数值不同
- **THEN** 系统保存新值为当前值，保留旧值及其采集时间，并在该数据点标注已修订

### Requirement: Freshness monitoring
系统 SHALL 根据每个序列的频率与典型发布延迟计算下次预计更新时间；超过预计时间仍未更新的序列 MUST 标为过期。

#### Scenario: Overdue series
- **WHEN** 周度初请失业金在预计发布日之后一个工作日仍未更新
- **THEN** 相关图表与信号显示过期标记、最后数据日期和预计更新时间

#### Scenario: Job health view
- **WHEN** 用户打开数据健康页面
- **THEN** 页面列出每个采集任务最近一次成功时间、最近一次失败及原因、待确认观测数量和过期序列

### Requirement: Reproducible derived metrics
系统 SHALL 用登记的公式与版本计算同比、3 个月年化、移动平均、距高点回撤、比值与历史分位等派生指标；任一输入缺失、待确认或过期时，派生结果 MUST 同样标记，不能用部分输入算出看似完整的数值。

#### Scenario: Input missing
- **WHEN** 计算核心 PCE 同比所需的去年同月数值缺失
- **THEN** 该期同比显示缺失及原因，而不是零或估算值

#### Scenario: Formula change
- **WHEN** 某派生指标的公式版本更新
- **THEN** 系统按新版本重新计算历史结果，并记录公式版本与变更时间

### Requirement: Manual entries
系统 SHALL 为没有可用接口的数据提供人工录入，录入时 MUST 填写来源链接、数据日期与单位；人工数据在页面上标记为人工录入，修改保留历史记录。

#### Scenario: Enter a manual data point without source
- **WHEN** 用户录入一条存储厂资本开支指引但未填写来源链接
- **THEN** 系统拒绝保存并提示必须填写来源

#### Scenario: Display manual data
- **WHEN** 页面展示人工录入的数据
- **THEN** 数值旁显示人工录入标记、录入时间和来源链接

### Requirement: No fabricated data and secret isolation
系统 MUST NOT 在正常运行环境中使用测试夹具、演示数据或估算值替代缺失的真实数据；供应商密钥 MUST 只在服务端读取，不出现在浏览器资源、页面响应或日志中。

#### Scenario: Provider unavailable at first run
- **WHEN** 部署后首次采集失败，数据库中没有该序列的任何观测
- **THEN** 页面显示暂无数据及原因，不加载测试数据

#### Scenario: Inspect client assets
- **WHEN** 检查生产构建的浏览器脚本、网络响应和服务端日志
- **THEN** 其中不存在 FRED、行情供应商或其他服务的密钥

### Requirement: Licensed personal use
系统 SHALL 为每个来源登记使用条件；由第三方持有版权的序列 MUST 标注版权方，并且只在受访问保护的私有部署中展示。

#### Scenario: Third-party copyrighted series
- **WHEN** 页面展示来自 FRED 的标普 500 或 ICE BofA 利差序列
- **THEN** 页面标注其版权方，且该页面只有通过访问保护的所有者可见
