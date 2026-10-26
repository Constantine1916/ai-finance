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

## 2026-10-26：确认技术方案、时效性与可编辑关注池

用户确认 PostgreSQL、全栈 TypeScript、pm2 与 cron、`aicave.cn` 子域名部署、默认信号阈值；要求优先保证时效性，关注池可编辑。规格据此更新，仍只有文档。

| 检查 | 状态 |
| --- | --- |
| OpenSpec `validate build-ai-finance-mvp --strict` | 通过 |
| 本地 Markdown 链接与规格结构 | 通过：16 份 Markdown 无断链；6 项能力、36 条需求、82 个场景；51 项实施任务均未勾选；文档中不再出现 SQLite |
| `git diff --cached --check` | 通过 |
| 美国财政部收益率曲线 CSV | 通过：2026-10-25 已有 10-23 数据，比 FRED `DGS10` 早一天 |
| BLS API v1（无密钥） | 通过：取得核心 CPI 2026 年 9 月数据 |
| Finnhub K 线（无密钥） | 返回 401；免费密钥是否可用待实测 |
| VPS 环境 | Nginx 监听 80/443；`aicave.cn` 解析到本机；现有证书只含 `aicave.cn` 与 `www.aicave.cn`；`finace.aicave.cn` 与 `finance.aicave.cn` 均无 DNS 记录；Docker 可用 |

未执行：带密钥的 FRED、BEA、Finnhub、Tiingo 实测；CBOE VIX 历史 CSV 地址返回网页而非数据，未采用；全部应用层检查。

## 2026-10-26：域名与 Finnhub 实测

| 检查 | 状态 |
| --- | --- |
| 阿里云 DNS | 按用户要求，用 VPS 上 acme.sh 保存的阿里云凭据添加 `finance.aicave.cn` A 记录（指向 `101.32.243.232`）；权威 DNS 与公共解析器（223.5.5.5）均已返回该地址；原有 7 条记录未改动 |
| Finnhub 免费密钥 | `/quote` SPY 返回报价；`/stock/candle` 返回 403；`^VIX` 返回需要付费订阅 |
| 本地配置 | Finnhub 密钥与 `SEC_USER_AGENT` 写入仓库根目录 `.env`（权限 600，已被 `.gitignore` 排除，未提交） |

## 2026-10-26：供应商密钥实测

密钥只保存在 `.env`（未提交），本节不记录密钥值。

| 来源 | 状态 |
| --- | --- |
| FRED 官方 API | 通过：`DGS10` 返回最新两期；`WTREGEN` 元数据单位为百万美元 |
| Tiingo | 通过：NVDA 2024-06-10 拆股前后复权价连续（拆股系数 10）；SOXX 最新到 2026-10-23。免费档每小时 50 次、每日 1000 次、每月 500 个代码，许可为仅限个人内部使用 |
| BEA | 首次失败（密钥未激活）；用户激活后重试通过：核心 PCE 价格指数（T20804 第 25 行，`DPCCRG`）2026 年 8 月 130.455，与 FRED `PCEPILFE` 一致 |
| Finnhub | 见上一节：报价可用，K 线与指数不可用 |

## 2026-10-26：1A 第 1 组（工程基础）

用户批准规格后开始实现。以下为真实运行结果，不含模拟。

| 检查 | 状态 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过，0 个问题 |
| `npm run test` | 通过，9 项（运行时配置校验：缺少数据库地址、所有者凭据不全、哈希格式、会话密钥长度、未配置来源、SEC 联系邮箱、错误信息不含密钥值、可信代理开关） |
| `npm run build` | 通过 |
| 干净副本（不含 `.env`，`npm ci` 后）四项检查 | 通过 |
| PostgreSQL 17.9 容器 | 健康，只监听 127.0.0.1:5434，内存约 23 MB；迁移创建 17 张表 |
| 备份与恢复 | `pg_dump` 后恢复到临时库，表数量与 worker 心跳一致，临时库已删除 |
| worker | 启动后写入心跳，收到 SIGTERM 正常退出 |
| `/api/health` | 只返回 `{"status":"ok"}`，`Cache-Control: no-store` |
| 构建产物密钥扫描 | 164 个文件、7 个密钥，0 处泄漏 |
| 依赖漏洞（`npm audit`） | 生产依赖 0 个；开发依赖 4 个中危，均为 drizzle-kit 内置的旧版 esbuild 开发服务器问题（GHSA-67mh-4wv8-2f99），drizzle-kit 不启动该服务器，npm 给出的修复是降级到 0.18，不采用 |

Next.js 构建时提示安全升级。经 `npm audit` 核实，16.4.0 存在严重漏洞，已直接升级到修复版 16.4.3，没有运行其提示的升级命令。
