## ADDED Requirements

### Requirement: Consistent stock identity
系统 SHALL 为支持的美国上市证券提供唯一规范化详情路由，并显式维护各供应商所需的代码映射。

#### Scenario: Resolve share class symbol
- **WHEN** 用户打开目录内含点号或连字符的证券
- **THEN** 页面保留一致的证券身份，对各供应商使用经过验证的映射，映射不明的组件显示未覆盖

#### Scenario: Invalid route symbol
- **WHEN** 路由包含无效或目录外代码
- **THEN** 页面显示未找到或不支持，不请求任意外部代码

### Requirement: TradingView stock components
系统 SHALL 提供 K 线、技术指标、财务与公司信息的 TradingView 嵌入组件，保留必要的品牌与来源信息，不将嵌入内容当作可提取的数据 API。

#### Scenario: View supported stock
- **WHEN** 用户打开供应商支持的证券且嵌入服务可用
- **THEN** 页面以该证券配置图表、技术、财务与公司组件，图表默认采用日线和适合中长期观察的范围

#### Scenario: Provider internal coverage limitation
- **WHEN** 供应商组件内部显示没有证券覆盖或数据权限
- **THEN** 页面保留供应商可见反馈和外部查看入口，不用虚构数据覆盖该状态

### Requirement: Widget lifecycle and failure handling
系统 SHALL 限制可加载的嵌入脚本来源，在证券切换或卸载时清理旧容器，并对可观测的外层脚本失败和等待超时提供反馈。

#### Scenario: Switch securities
- **WHEN** 用户由证券 A 切换到证券 B
- **THEN** 页面标题与组件配置切换到 B，旧组件容器被清理，不持续显示 A 的配置

#### Scenario: Script blocked or loading timeout
- **WHEN** 外层脚本被网络或浏览器阻止，或组件加载等待超时
- **THEN** 页面提供失败或等待提示、重试与外部查看链接，自选股等其他功能仍可使用

### Requirement: Stock page integrations
系统 SHALL 在个股页提供当前用户的自选状态及复用的情绪摘要，各组件独立处理不可用状态。

#### Scenario: Missing sentiment configuration
- **WHEN** 用户打开个股详情而 Adanos 未配置
- **THEN** 页面显示情绪未配置提示，图表和自选操作不因此失败
