# 数据源与授权边界

核对日期：2026-10-18。供应商条款、额度与覆盖可能变化，上线前按届时适用条款复核。当前没有采购付费计划，也没有真实供应商凭据测试。

| 来源 | 本项目用途 | 免费模式的边界 |
| --- | --- | --- |
| TradingView Widgets | 市场、K 线、技术、财务、公司信息嵌入 | 免费组件保留其品牌与归属；覆盖和延迟由组件决定，不能当作自有数据 API |
| Nasdaq Trader Symbol Directory | 美国上市证券代码、名称、交易所与类型 | 仅作证券元数据；记录来源与快照时间，不等于提供报价或授权其他数据 |
| Finnhub | 可选的自选股、关注池独立行情字段 | 个人计划不能自动视为允许多用户共享展示，默认关闭，按适用授权启用 |
| Adanos | Reddit、X、新闻、Polymarket 情绪 | 免费计划每月 250 次请求且非商业；共享展示适用性需确认，默认关闭 |

Finnhub / Adanos 没有启用时，账户、自选股身份列表、证券搜索和可用的 TradingView 组件仍是第一版的完整流程。依赖这些 API 的字段应显示未配置或受限，不能用从组件抓取数据的方式填补。

供应商失败不等于数值为零。缓存获取时间也不等于行情本身的时间。默认行情缓存 1 小时、情绪缓存 24 小时；应用会展示自建字段的时效。TradingView 内部时间与延迟使用其自身标识。

## 一手资料

- [TradingView 官方 Widgets 说明与常见问题](https://www.tradingview.com/widget/)：组件能力、数据覆盖、品牌与 API 边界。
- [Finnhub 服务条款](https://finnhub.io/terms-of-service)：个人使用、业务使用、共享与再分发边界。
- [Adanos 官方定价](https://adanos.com/pricing)：免费额度、来源与商业使用限制。
- [Nasdaq Trader 目录字段定义](https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs)：目录格式、测试证券、ETF 与交易所字段。
- [Nasdaq 上市证券目录](https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt)与[其他交易所上市目录](https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt)：拟导入的元数据来源。

## 上游实现依据

研究固定在 [OpenStock 基线提交](https://github.com/Open-Dev-Society/OpenStock/tree/dc2db1bb2fdce2da3bb1eba7c51a73ad52f7d464)。

- [TradingViewWidget.tsx](https://github.com/Open-Dev-Society/OpenStock/blob/dc2db1bb2fdce2da3bb1eba7c51a73ad52f7d464/components/TradingViewWidget.tsx)：组件脚本容器。
- [finnhub.actions.ts](https://github.com/Open-Dev-Society/OpenStock/blob/dc2db1bb2fdce2da3bb1eba7c51a73ad52f7d464/lib/actions/finnhub.actions.ts)：服务端行情调用与缓存。
- [watchlist.actions.ts](https://github.com/Open-Dev-Society/OpenStock/blob/dc2db1bb2fdce2da3bb1eba7c51a73ad52f7d464/lib/actions/watchlist.actions.ts)：用户自选股流程。
- [adanos.helpers.ts](https://github.com/Open-Dev-Society/OpenStock/blob/dc2db1bb2fdce2da3bb1eba7c51a73ad52f7d464/lib/actions/adanos.helpers.ts)：来源接口、字段解析和规范化。
- [auth.ts](https://github.com/Open-Dev-Society/OpenStock/blob/dc2db1bb2fdce2da3bb1eba7c51a73ad52f7d464/lib/better-auth/auth.ts)：Better Auth 与数据库配置。

Inngest 用于上游的邮件和定时流程，本项目这四个模块不需要先引入。Adanos 的新闻来源不扩展为新闻独立板块。
