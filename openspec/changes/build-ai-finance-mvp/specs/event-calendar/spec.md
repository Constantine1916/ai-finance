## ADDED Requirements

### Requirement: Event schedule
系统 SHALL 提供 FOMC 会议、CPI、非农就业、PCE 与初请失业金发布日，以及关注公司财报日的日程；每个事件 MUST 标注来源与是否已经确认。

#### Scenario: Upcoming events
- **WHEN** 用户打开总览
- **THEN** 页面列出未来 30 天的事件，按日期排序并显示北京时间与美东时间

#### Scenario: Unconfirmed earnings date
- **WHEN** 公司尚未公布下一次财报日期
- **THEN** 事件显示为未确认或不显示，不以推算日期冒充已确认日期

### Requirement: Event to data link
系统 SHALL 在宏观数据发布事件过后，把该事件关联到对应序列的新观测；预计发布的数据未按时到达时 MUST 显示延迟。

#### Scenario: Release day data arrives
- **WHEN** CPI 发布日的追加采集成功
- **THEN** 日程中该事件显示已发布，并链接到更新后的通胀图表

#### Scenario: Release day data missing
- **WHEN** 发布日之后的采集仍未得到新观测
- **THEN** 事件显示数据未到达，相关序列按时效规则标为过期

### Requirement: Maintained schedule sources
系统 SHALL 从官方发布日程导入或由用户人工维护事件；人工维护的事件 MUST 填写来源链接。

#### Scenario: Add an earnings date manually
- **WHEN** 用户录入一条财报日期但未填写来源链接
- **THEN** 系统拒绝保存并提示必须填写来源
