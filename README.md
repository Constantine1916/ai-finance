# ai-finance

面向中长期美股与 AI 股票研究的数据看板。以 [OpenStock](https://github.com/Open-Dev-Society/OpenStock) 的实现方式为参考，独立建仓，不使用 GitHub Fork。

**当前状态：规格设计阶段，等待用户审阅。尚无应用代码，不能启动看板。**

## 第一版范围

| 模块 | 计划行为 |
| --- | --- |
| 美股市场看板 | 美股市场概览、TradingView 热力图、人工维护的 AI 关注池、证券搜索 |
| 个股详情 | TradingView K 线、技术指标、财务与公司信息；独立显示数据来源与受限状态 |
| 自选股 | 邮箱密码账户、每人独立保存，最多 50 只，支持添加、删除与跨会话恢复 |
| 情绪分析 | 对接 Adanos 的 Reddit、X、新闻、Polymarket 数据，分别展示各来源覆盖情况 |

免费优先。没有密钥、没有适用授权、额度耗尽或供应商无覆盖时，明确显示原因。不会用演示价格、零值或生成内容填补缺失的真实金融数据。

账户是支撑能力。第一版不含价格提醒、新闻独立页面、AI 邮件、交易执行、持仓核算、社交登录和密码重置。只做美股市场入口。

## 规格与开发方式

采用 OpenSpec 的 SDD 流程：需求场景 → 技术设计 → 实施任务 → 实现与验证 → 归档。规格检查通过不代表功能已实现。

- [设计审阅入口](docs/superpowers/specs/2026-10-18-ai-finance-design.md)
- [需求提案](openspec/changes/build-ai-finance-mvp/proposal.md)
- [技术设计](openspec/changes/build-ai-finance-mvp/design.md)
- [六项能力的验收规格](openspec/changes/build-ai-finance-mvp/specs/)
- [实施任务](openspec/changes/build-ai-finance-mvp/tasks.md)
- [数据源与授权边界](docs/data-sources.md)
- [验证记录](docs/verification.md)

本机已验证 Node.js 24 可运行以下文档检查；OpenSpec CLI 固定为 1.14.3：

```sh
OPENSPEC_TELEMETRY=0 OPENSPEC_NO_UPDATE_CHECK=1 npx --yes @fission-ai/openspec@1.14.3 validate build-ai-finance-mvp --strict
```

拟采用 Next.js App Router、TypeScript、Tailwind CSS、Better Auth、MongoDB、TradingView 嵌入组件，以及可选的 Finnhub / Adanos 服务端适配器。规格批准后再固定应用依赖版本并实现本地运行与 Docker 交付。

## 开源与来源

本项目使用 [AGPL-3.0](LICENSE)，复用范围与来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本仓库不是 OpenStock 官方产品。数据服务与 TradingView 组件各自的条款不因代码开源而改变。
