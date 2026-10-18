# 第三方来源与许可

## OpenStock

- 项目：[Open-Dev-Society/OpenStock](https://github.com/Open-Dev-Society/OpenStock)
- 研究基线：[`dc2db1bb2fdce2da3bb1eba7c51a73ad52f7d464`](https://github.com/Open-Dev-Society/OpenStock/tree/dc2db1bb2fdce2da3bb1eba7c51a73ad52f7d464)，核对于 2026-10-18。
- 原项目作者与贡献者保留其权利。
- 许可：[上游 AGPL-3.0 原文](https://github.com/Open-Dev-Society/OpenStock/blob/dc2db1bb2fdce2da3bb1eba7c51a73ad52f7d464/LICENSE)。本仓库的 `LICENSE` 保留相同许可证原文。
- 仓库关系：独立 Git 历史，不是 GitHub Fork；这不免除实际改编源码所附带的许可义务。

当前提交只包含规格文档，尚未移植应用源码。后续计划参考或选择性改编以下实现；实际改编时在对应文件保留来源标注，并在本文件登记最终文件映射：

| 上游文件 | 参考内容 | 本项目设计中的调整 |
| --- | --- | --- |
| `components/TradingViewWidget.tsx`、`lib/constants.ts` | 嵌入脚本与配置组织方式 | 限定美股，保留供应商品牌，增加加载与失败提示 |
| `lib/better-auth/auth.ts`、`lib/actions/auth.actions.ts` | 邮箱密码账户、会话与 MongoDB | 仅保留第一版账户能力，严格校验服务端会话 |
| `lib/actions/watchlist.actions.ts`、`database/models/watchlist.model.ts` | 用户维度持久化、自选股上限 | 单文档原子更新，防止并发超出 50 只 |
| `lib/actions/finnhub.actions.ts` | 服务端请求、缓存、去重与超时 | 增加共享展示授权开关与跨进程配额约束 |
| `lib/actions/adanos.actions.ts`、`lib/actions/adanos.helpers.ts`、`components/stocks/StockSentimentCard.tsx` | 四类情绪源的接口与规范化 | 独立展示各源状态，不隐藏缺失配置，不把缺失计为零 |

不复制 OpenStock 名称、标志与宣传素材作为本项目品牌。

## 数据与组件服务

TradingView、Finnhub、Adanos 和 Nasdaq 的名称及数据由相应权利人持有。代码许可不授予其数据的再分发权。使用条件见 [数据源说明](docs/data-sources.md)。后续实际安装依赖时另核对依赖许可；目前尚无应用依赖锁文件。
