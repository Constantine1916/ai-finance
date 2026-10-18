## ADDED Requirements

### Requirement: Email password account lifecycle
系统 SHALL 提供邮箱密码注册、登录与退出，使用认证库管理密码与会话，不保存明文密码，不宣称未验证的邮箱已经验证。

#### Scenario: Register and sign in
- **WHEN** 新用户提交有效且未注册的邮箱和符合密码规则的密码
- **THEN** 系统创建账户并允许用户通过邮箱密码登录，进入市场看板

#### Scenario: Invalid credentials
- **WHEN** 用户提交错误凭据或尝试重复注册
- **THEN** 系统返回不含内部敏感信息的可理解反馈，不建立未经验证的会话

#### Scenario: Sign out
- **WHEN** 用户退出后再次使用旧会话请求受保护资源
- **THEN** 服务端拒绝该请求，浏览器需要重新登录

### Requirement: Server enforced access control
系统 SHALL 在服务端保护四个业务页面及其数据动作，并从已验证会话确定当前用户，不依赖客户端提供的用户身份。

#### Scenario: Unauthenticated access
- **WHEN** 未登录访问业务页面或调用业务数据接口
- **THEN** 页面跳转登录入口，接口拒绝访问，且不发起供应商调用

#### Scenario: Forged owner
- **WHEN** 用户 A 在请求中填写用户 B 的标识
- **THEN** 系统不按该标识访问用户 B 的资源，只允许操作会话所属资源或拒绝请求

#### Scenario: Database unavailable
- **WHEN** 认证或用户存储无法连接数据库
- **THEN** 系统显示服务暂不可用，不绕过认证或使用其他用户的缓存结果

### Requirement: Authentication request protection
系统 SHALL 对注册与登录启用跨实例有效的限流，并在生产环境使用安全会话 Cookie 与同源请求约束。

#### Scenario: Repeated authentication attempts
- **WHEN** 相同限流维度在规定窗口超过配置上限
- **THEN** 系统拒绝后续尝试并返回可识别的限流反馈

#### Scenario: Untrusted forwarded address
- **WHEN** 未配置可信代理的请求自带转发 IP 头
- **THEN** 系统不允许该头覆盖限流所使用的连接来源
