## ADDED Requirements

### Requirement: Provider configuration and permission gates
系统 SHALL 在服务端检查 API 密钥与共享展示启用配置；启用配置不替代供应商授权。默认关闭 Finnhub 和 Adanos 的共享展示。

#### Scenario: API key without enabled shared use
- **WHEN** 操作员仅填写供应商密钥而未启用共享展示
- **THEN** 系统返回受限状态，不调用该供应商，也不展示其缓存数据

#### Scenario: Missing key
- **WHEN** 适配器没有对应密钥
- **THEN** 系统返回未配置状态，不发送空密钥请求

### Requirement: Consistent result and timestamp semantics
系统 SHALL 返回可识别的数据状态、来源、获取时间、到期时间和原因；仅在供应商提供时返回数据时间，并区分有效零值与缺失值。

#### Scenario: Missing numeric field
- **WHEN** 供应商成功响应但所需字段缺失
- **THEN** 该字段显示缺失，不转换为零或沿用其他证券的值

#### Scenario: Valid zero value
- **WHEN** 供应商明确返回有效数值零
- **THEN** 系统保留零值，不把它误判为缺失

#### Scenario: No provider data timestamp
- **WHEN** 供应商未给出数据本身的时间
- **THEN** 页面只标注获取时间，不将其声称为实时行情时间

### Requirement: Shared cache and refresh coordination
系统 SHALL 使用跨实例有效的缓存与有期限的刷新租约；行情默认缓存 1 小时，情绪按证券、来源、窗口缓存 24 小时，并在读取时检查期限。

#### Scenario: Concurrent identical requests
- **WHEN** 两个实例同时请求相同缓存键且需要刷新
- **THEN** 只有有效租约持有者执行该次上游刷新，其他请求等待有限时间或使用明确标记的已有结果

#### Scenario: Expired cache and failed refresh
- **WHEN** 缓存已过期且刷新失败，授权仍允许使用原数据
- **THEN** 有原数据时标明过期、原时间与失败原因，无原数据时显示不可用

#### Scenario: Permission revoked after caching
- **WHEN** 已有供应商缓存但操作员关闭共享展示配置
- **THEN** 系统立即返回受限状态，不继续展示缓存金融数据

### Requirement: Atomic budgets and bounded requests
系统 SHALL 在跨实例存储中原子预留供应商预算，限制并发与超时；Adanos 默认预算为每 UTC 自然月 200 次请求，Finnhub 分钟预算可配置。

#### Scenario: Concurrent requests reach remaining budget
- **WHEN** 多个实例同时争用最后一个可用请求名额
- **THEN** 只有一个成功预留并调用，其余返回限流状态

#### Scenario: Provider returns 429
- **WHEN** 供应商返回 429 以及可用的 Retry-After
- **THEN** 系统记录共享冷却期限，期限内不立即重试，并向用户显示限流状态

#### Scenario: Provider timeout or database failure
- **WHEN** 上游超过配置超时，或预算存储无法使用
- **THEN** 系统有限时间内返回失败，不无限重试，也不绕过预算直接请求供应商

### Requirement: Secrets and private data isolation
系统 SHALL 将密钥仅保留在服务端；共享市场数据缓存不得包含用户会话、邮箱或个人自选列表，响应和日志不得泄漏密钥。

#### Scenario: Inspect client assets and responses
- **WHEN** 检查生产浏览器脚本、网络响应和错误信息
- **THEN** 不存在供应商密钥、数据库连接凭据或其他账户的私有数据

#### Scenario: Same stock requested by different users
- **WHEN** 两个用户请求同一证券的被授权公共行情
- **THEN** 允许共享市场数据缓存，但各自自选状态仍从自己的会话资源读取

### Requirement: Test and live data separation
系统 SHALL 只在显式测试环境使用标明来源的测试夹具，并将供应商模拟验证和真实连接验证分别记录。

#### Scenario: Missing provider in normal runtime
- **WHEN** 正常运行环境缺少供应商配置
- **THEN** 系统显示未配置，不自动加载测试价格或情绪数据
