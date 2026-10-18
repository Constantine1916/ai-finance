## ADDED Requirements

### Requirement: Account isolated persistent watchlist
系统 SHALL 为每个账户独立持久化自选股，所有读取与写入从服务端会话确定所有者。

#### Scenario: Two users with different lists
- **WHEN** 用户 A 与 B 分别登录并读取或修改自选股
- **THEN** 只能访问各自列表，A 的增删不改变 B 的结果

#### Scenario: Restore after process restart
- **WHEN** 用户添加证券后退出，应用重启，再次登录同一账户
- **THEN** 系统从 MongoDB 恢复相同列表，而不是依赖浏览器或进程内存

### Requirement: Atomic cap and uniqueness
系统 SHALL 将每个账户的自选股限制为最多 50 个不同的规范化证券，并通过数据库原子条件更新同时保证去重与数量上限。

#### Scenario: Duplicate addition
- **WHEN** 用户重复添加相同证券，包括可归一化为同一代码的输入
- **THEN** 列表只保留一条，数量不增加，并显示已存在的反馈

#### Scenario: Concurrent requests near capacity
- **WHEN** 已有 49 只的列表并发添加两个不同证券
- **THEN** 最多一个添加成功，最终数量不超过 50，另一请求收到上限反馈

#### Scenario: Concurrent first creation
- **WHEN** 新账户并发首次添加证券
- **THEN** 系统只建立该用户的一份列表，不出现重复文档或超出数量约束

### Requirement: Watchlist mutations and feedback
系统 SHALL 支持从搜索或详情添加有效证券、从自选列表删除，并提供空列表、重复、上限和写入失败的反馈。

#### Scenario: Remove an item
- **WHEN** 用户删除自己列表中的证券
- **THEN** 持久化结果移除该项，页面更新，自选数量释放一个名额

#### Scenario: Failed mutation
- **WHEN** 数据库写入失败
- **THEN** 页面不将失败操作显示为已保存，并允许用户重试

### Requirement: Watchlist data provenance
系统 SHALL 在自选列表展示证券身份及可用的行情，按数据访问规格标注来源、时间和限制，不影响列表本身的可用性。

#### Scenario: Quote provider restricted
- **WHEN** 列表已经保存而 Finnhub 共享展示未启用
- **THEN** 证券仍能查看、删除和进入详情，行情显示受限原因，不显示占位价格
