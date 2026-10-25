## ADDED Requirements

### Requirement: Transparent signal rules
系统 SHALL 以版本化配置定义每条信号规则，包括输入序列、判断条件、阈值和中文说明；每条信号 MUST 在页面显示当前值、近期变化、规则原文与状态（正常、关注、警示、数据不足）。

#### Scenario: View a signal
- **WHEN** 用户查看高收益债利差信号
- **THEN** 页面显示当前利差、3 个月变化、触发警示的规则与阈值，以及计算所用的数据日期

#### Scenario: Change a threshold
- **WHEN** 用户修改某条规则的阈值
- **THEN** 系统保存新阈值并记录修改时间，信号状态与历史表现按新阈值重新计算

#### Scenario: Insufficient data
- **WHEN** 规则的任一输入缺失、过期或待确认
- **THEN** 该信号显示数据不足及原因，不显示为正常

### Requirement: No composite score or trading instruction
系统 MUST NOT 生成跨信号的综合评分、仓位比例或买卖指令；总览页面 SHALL 说明信号只是规则判断，仓位决定由用户作出。

#### Scenario: Several signals in warning
- **WHEN** 多条信号同时处于警示
- **THEN** 页面分别列出各信号，不合成一个分数或给出加减仓建议

### Requirement: Signal history and track record
系统 SHALL 为每条规则展示历史触发日期，以及触发后标普 500 与半导体板块 3、6、12 个月的涨跌和最大回撤；用修订后数据回看历史时 MUST 标注存在前视偏差。

#### Scenario: Review a rule history
- **WHEN** 用户查看收益率曲线倒挂后转正规则的历史
- **THEN** 页面列出每次触发日期及随后的指数表现，包括触发后没有出现预期结果的情况

#### Scenario: Revised data used
- **WHEN** 历史回看所用序列没有当时公布版本
- **THEN** 结果旁标注使用修订后数据、可能存在前视偏差

#### Scenario: Not enough history
- **WHEN** 序列历史太短，无法计算某个观察期的后续表现
- **THEN** 该期显示数据不足，而不是零或部分区间的结果

### Requirement: Cycle quadrant
系统 SHALL 提供增长与通胀两轴的周期象限，公开两轴所用序列与计算方式，并显示最近 12 个月的位置轨迹。

#### Scenario: View quadrant
- **WHEN** 用户打开总览
- **THEN** 象限显示当前所处格（复苏、过热、滞胀、衰退）、12 个月轨迹、两轴定义与最新数据日期

#### Scenario: Axis data stale
- **WHEN** 任一轴的输入序列过期
- **THEN** 象限显示过期标记和最后可用的月份，不外推当前位置

### Requirement: Signal state log
系统 SHALL 记录每条信号的状态变化及当时的输入值，供用户回看。

#### Scenario: State changes
- **WHEN** 某信号由正常变为警示
- **THEN** 信号日志新增一条记录，包含时间、前后状态、输入值与规则版本
