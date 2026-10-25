## ADDED Requirements

### Requirement: Single owner authentication
系统 SHALL 只允许部署时配置的唯一所有者登录；系统 MUST NOT 提供公开注册入口，也不保存明文密码。

#### Scenario: Owner signs in
- **WHEN** 所有者提交正确的登录凭据
- **THEN** 系统建立有期限的会话并进入总览页面

#### Scenario: Wrong credentials
- **WHEN** 提交的凭据不正确
- **THEN** 系统拒绝登录，反馈中不透露账户是否存在或其他内部信息

#### Scenario: Registration attempt
- **WHEN** 访问者尝试访问注册路径或调用注册接口
- **THEN** 系统返回不存在或拒绝，不创建任何账户

#### Scenario: Owner credentials not configured
- **WHEN** 生产环境未配置所有者凭据或会话密钥
- **THEN** 应用拒绝提供受保护页面并在服务端日志说明缺少配置，不退化为免登录访问

### Requirement: Server enforced protection
系统 SHALL 在服务端为所有看板页面、数据接口、人工录入与数据健康页面校验会话；只开放登录入口、静态资源与不含数据的健康检查。

#### Scenario: Unauthenticated page request
- **WHEN** 未登录访问看板页面
- **THEN** 页面跳转到登录入口，响应中不包含任何金融数据

#### Scenario: Unauthenticated data request
- **WHEN** 未登录直接调用数据接口或人工录入接口
- **THEN** 接口拒绝访问且不读取或写入数据

#### Scenario: Sign out
- **WHEN** 所有者退出后再次使用旧会话请求受保护资源
- **THEN** 服务端拒绝该请求

#### Scenario: Health check
- **WHEN** 外部监控访问健康检查端点
- **THEN** 只返回应用是否存活，不返回序列、数值或任务细节

### Requirement: Login abuse protection
系统 SHALL 对登录尝试限流，并在生产环境只通过 HTTPS 提供服务，使用安全会话 Cookie 与同源约束。

#### Scenario: Repeated failed logins
- **WHEN** 同一连接来源在配置的时间窗口内连续登录失败超过上限
- **THEN** 系统暂时拒绝后续登录尝试并返回限流反馈

#### Scenario: Untrusted forwarded address
- **WHEN** 未配置可信代理的请求自带转发 IP 头
- **THEN** 系统不使用该头作为限流的连接来源
