# 验证记录

## 2026-10-18：规格阶段

当前只有文档，没有应用代码。以下仅为文档与仓库检查，不代表业务功能可用。

本次文档检查结果：

| 检查 | 状态 |
| --- | --- |
| OpenSpec `validate build-ai-finance-mvp --strict --json` | 通过，1 项变更、0 个问题 |
| 本地 Markdown 文件链接、未完成占位、任务勾选与规格场景检查 | 通过，15 份 Markdown、6 项能力、24 条需求、52 个场景；29 项实施任务均未勾选 |
| 许可证原文比对 | 通过，与研究基线上游 LICENSE 字节一致 |
| `git diff --check` 与 `git diff --cached --check` | 通过，新增文件已纳入暂存检查 |
| GitHub 可见性、非 Fork 状态与远程提交一致性 | 通过：`isPrivate=false`、`isFork=false`、默认分支 `main`；修正作者后的首次规格提交为 `9a32483`，本地与远程已核对一致 |

使用的 CLI：`@fission-ai/openspec@1.14.3`；运行时：Node.js 24.21.0。CLI 通过 `npx` 使用，不全局安装，也不改写用户级代理提示文件。

OpenSpec `status` 报告规划产物完整；其 `isComplete` 描述规划状态，不表示这 29 项实施任务已经完成。当前变更保持未归档。

未执行且本阶段无法声称通过：应用类型检查、lint、构建、MongoDB 集成测试、浏览器业务流程、真实 TradingView 页面验证、真实 Finnhub / Adanos 数据调用。原因是应用尚未实现，且没有适用授权与供应商凭据的实测环境。

上游代码已按固定提交阅读。供应商官方文档已用于设计边界，不能代替应用运行验证。功能验收项见 OpenSpec 任务清单。

## 2026-10-18：提交身份修正

原两次提交错误继承了全局 Git 身份。按用户要求，将仓库本地的 `user.name` 设为 `Constantine`，`user.email` 设为 `constantine1916@foxmail.com`，并修正原两次提交的作者和提交者。保留原文件树、提交说明与日期；更新前保存本地备份引用，以指定旧远程 SHA 的 `--force-with-lease` 推送。

GitHub API 已确认这两次提交的作者和提交者均使用指定姓名、邮箱，并关联到 `Constantine1916`。项目约定增加同样的提交身份检查，后续提交不再继承全局工作邮箱。

## 2026-10-25：第一阶段范围重写

按用户确认，第一阶段改为个人使用的宏观与 AI 产业看板，替换 2026-10-18 未批准的多用户四模块草案。仍然只有文档，没有应用代码。

| 检查 | 状态 |
| --- | --- |
| OpenSpec `validate build-ai-finance-mvp --strict --json` | 通过，1 项变更、0 个问题 |
| OpenSpec `status` | 规划产物 4/4 完整；不表示实施任务已完成 |
| 本地 Markdown 链接、规格结构与任务勾选 | 通过：16 份 Markdown 无断链；6 项能力、34 条需求、71 个场景，每条需求含 SHALL 或 MUST；47 项实施任务均未勾选 |
| `git diff --cached --check` | 通过 |
| FRED 序列可得性（无密钥 `fredgraph.csv`） | 通过：设计所列序列均返回数据，起始日期记入 `docs/data-sources.md`；`RU2000PR` 不可得；`SP500` 仅近 10 年，ICE BofA 利差仅近 3 年 |
| SEC EDGAR `companyfacts` 与 `submissions` | 通过：NVDA、GOOGL 返回 2026 年季报数据；TSM 仅年度 20-F；台积电持续报送 6-K |
| OpenStock 数据来源 | 已阅读提交 `855ca6a` 源码，结论记入 `docs/data-sources.md` |

使用的 CLI：`@fission-ai/openspec@1.14.3`；运行时：Node.js 22.22.0。

未执行：带密钥的 FRED API 采集、日线行情供应商实测（免费额度与条款尚未在官网核实）、韩国关税厅接口核实、台积电官网月营收采集，以及全部应用层检查（应用尚未实现）。

提交身份规则按用户要求调整为只要求邮箱 `constantine1916@foxmail.com`，姓名不限。GitHub API 确认此前提交通过该邮箱关联到账号 `Constantine1916`；本次提交使用全局身份 `Constantine1916 <constantine1916@foxmail.com>`。
