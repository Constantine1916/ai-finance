# 第三方来源与许可

## OpenStock

- 项目：[Open-Dev-Society/OpenStock](https://github.com/Open-Dev-Society/OpenStock)
- 研究基线：[`dc2db1bb2fdce2da3bb1eba7c51a73ad52f7d464`](https://github.com/Open-Dev-Society/OpenStock/tree/dc2db1bb2fdce2da3bb1eba7c51a73ad52f7d464)，核对于 2026-10-18。
- 原项目作者与贡献者保留其权利。
- 许可：[上游 AGPL-3.0 原文](https://github.com/Open-Dev-Society/OpenStock/blob/dc2db1bb2fdce2da3bb1eba7c51a73ad52f7d464/LICENSE)。本仓库的 `LICENSE` 保留相同许可证原文。
- 仓库关系：独立 Git 历史，不是 GitHub Fork；这不免除实际改编源码所附带的许可义务。

当前提交只包含规格文档，尚未移植应用源码。2026-10-25 第一阶段改为个人使用的宏观与 AI 产业看板后，参考范围缩小为下表；实际改编时在对应文件保留来源标注，在本文件登记最终文件映射，并把研究基线更新到届时的上游提交（2026-10-25 查看的最新提交为 `855ca6a`）：

| 上游文件 | 参考内容 | 本项目设计中的调整 |
| --- | --- | --- |
| `components/TradingViewWidget.tsx`、`lib/constants.ts` | 嵌入脚本与配置组织方式 | 只用于个股详情的 K 线，保留供应商标识，增加加载失败与超时提示 |
| `lib/seo/edgar.ts` | SEC 访问规范、申报链接构造 | 改为采集 XBRL 财务数据并保存申报编号 |

此前计划参考的账户、自选股、Finnhub 与 Adanos 相关文件属于第 2 阶段范围，第一阶段不改编。

不复制 OpenStock 名称、标志与宣传素材作为本项目品牌。

## 数据与组件服务

FRED 上的第三方序列（S&P、Nasdaq、ICE 等）、日线行情供应商、台积电、TradingView 的名称及数据由相应权利人持有。代码许可不授予其数据的再分发权。使用条件见 [数据源说明](docs/data-sources.md)。后续实际安装依赖时另核对依赖许可；目前尚无应用依赖锁文件。
