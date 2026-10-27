# 数据源与授权边界

核对日期：2026-10-25 至 10-26。供应商条款、额度与覆盖可能变化，上线前按届时条款复核。下文“已实测”指在本机发出了真实请求并看到返回；尚未使用任何供应商密钥做完整采集。

## 来源总览

| 等级 | 来源 | 用途 | 获取方式 | 状态 |
| --- | --- | --- | --- | --- |
| 官方一手 | [FRED](https://fred.stlouisfed.org/) | 利率、通胀、信用、就业、增长、流动性、部分指数 | 官方 API，需要免费密钥 | 2026-10-26 用密钥实测官方 API 可用；序列可得性见下表 |
| 官方一手 | [美国财政部收益率曲线](https://home.treasury.gov/resource-center/data-chart-center/interest-rates) | 当日国债收益率（1 个月至 30 年） | 官网 CSV，无需密钥 | 已实测：2026-10-25 已有 10-23 的数据，同一时间 FRED `DGS10` 只到 10-22 |
| 官方一手 | [BLS API](https://www.bls.gov/developers/) | CPI、非农（发布即取） | v1 无需密钥（每日次数较少），v2 需免费密钥 | 已实测 v1：取得核心 CPI 2026 年 9 月数据 |
| 官方一手 | [BEA API](https://apps.bea.gov/api/) | PCE（发布即取） | 需免费密钥 | 2026-10-26 激活后实测可用：NIPA 表 T20804 第 25 行（`DPCCRG`，核心 PCE 价格指数）2026 年 8 月为 130.455，与 FRED `PCEPILFE` 一致。同表第 31 行是“市场定价”口径（`DPCXRG`），名称相近，须按序列代码取值 |
| 商业接口 | [Finnhub](https://finnhub.io/) | 盘中报价快照（与 OpenStock 相同的 `/quote`） | 免费密钥，每分钟 60 次 | 2026-10-26 用免费密钥实测：SPY 报价可用；K 线返回 403；VIX 等指数报价需要付费订阅。因此只用于股票与 ETF 盘中快照 |
| 官方一手 | [SEC EDGAR](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | 美股公司财报与申报列表 | `companyfacts`、`submissions` 接口，无需密钥，需声明 User-Agent | 已实测 NVDA、GOOGL、TSM |
| 官方一手 | 台积电投资者关系、台湾公开资讯观测站、SEC 6-K | 台积电月营收 | 官网采集，以 6-K 交叉核对 | 已确认 EDGAR 上台积电持续报送 6-K；官网页面尚未采集 |
| 官方一手 | 韩国关税厅 | 半导体出口（每月 1 日全月、21 日前 20 天） | 先人工录入；data.go.kr 接口待核实 | 未实测 |
| 商业接口 | [Tiingo](https://www.tiingo.com/) 日线行情 | ETF 与个股的复权收盘价 | API，免费密钥 | 2026-10-26 实测可用：NVDA 2024-06-10 拆股（系数 10）前后复权价连续，SOXX 最新到 10-23。免费档：每小时 50 次、每日 1000 次、每月 500 个代码、每月 1 GB 流量，许可为“仅限个人内部使用”，与本项目的私有部署一致 |
| 付费或无接口 | TrendForce、DRAMeXchange | 存储现货与合约价格 | 人工录入公开报告，不抓取网页 | — |
| 付费 | FactSet、LSEG 等 | 分析师一致预期与盈利修正 | 第一阶段不提供 | — |
| 嵌入展示 | [TradingView Widgets](https://www.tradingview.com/widget/) | 个股详情的 K 线 | 浏览器加载，保留其标识 | 只展示，不提取数据 |

## FRED 序列实测结果

2026-10-25 通过 `fredgraph.csv` 逐个请求，记录可得的起始日期。实现时改用带密钥的官方 API。

| 类别 | 序列 | 起始 | 说明 |
| --- | --- | --- | --- |
| 利率 | `DGS3MO`、`DGS2`、`DGS5`、`DGS10`、`DGS20`、`DGS30` | 1962～1981 | 日度 |
| 利差 | `T10Y2Y`、`T10Y3M` | 1976、1982 | 日度 |
| 实际利率与通胀预期 | `DFII10`、`T10YIE`、`T5YIFR` | 2003 | 日度 |
| 期限溢价 | `THREEFYTP10` | 1990 | Kim-Wright 模型 |
| 政策利率 | `DFF` | 1954 | 日度 |
| 通胀 | `CPIAUCSL`、`CPILFESL`、`PCEPILFE` | 1947～1959 | 月度 |
| 商品与美元 | `DCOILWTICO`、`DCOILBRENTEU`、`DTWEXBGS`、`APU000072610`（电价） | 1978～2006 | — |
| 信用 | `BAMLH0A0HYM2`、`BAMLC0A0CM` | **仅最近 3 年**（2023-10 起） | ICE 版权；长历史用 HYG/IEF 比值替代 |
| 就业与增长 | `UNRATE`、`SAHMREALTIME`、`ICSA`、`PAYEMS`、`INDPRO`、`IPG3344S` | 1919～1972 | `IPG3344S` 为半导体与电子元件工业产出 |
| 制造业调查 | `GACDFSA066MSFRBPHI`、`NOCDFSA066MSFRBPHI` | 1968 | 费城联储，替代需付费的 ISM |
| 流动性 | `WALCL`、`WTREGEN`、`RRPONTSYD`、`NFCI` | 1971～2003 | 单位不同：`WTREGEN` 经 API 元数据确认为百万美元；`WALCL` 从量级看为百万美元，`RRPONTSYD` 为十亿美元，实现时以序列元数据为准 |
| 指数 | `SP500` | **仅最近 10 年** | S&P 版权 |
| 指数 | `NASDAQCOM`、`NASDAQ100` | 1971、1986 | Nasdaq 版权 |
| 波动率 | `VIXCLS`、`VXVCLS` | 1990、2007 | VIX 与 VIX3M |
| 不可得 | 罗素 2000（`RU2000PR`）、费城半导体指数 | — | 请求返回网页而非数据；改用 IWM、SOXX |

## SEC EDGAR 实测结果

- 必须在 User-Agent 中注明用途与联系邮箱，请求频率低于每秒 10 次（[SEC 访问规范](https://www.sec.gov/os/accessing-edgar-data)）。联系邮箱通过环境变量 `SEC_USER_AGENT` 配置，不写入仓库。
- NVDA、GOOGL 可取得 2026 年的季报数据。
- 同一指标的科目名称会变：NVDA 的 `PaymentsToAcquirePropertyPlantAndEquipment` 只到 2020 年，之后改用其他科目，需要按公司维护映射。
- 季报数值是年初至今累计值，单季值需要相减得到。
- 台积电（TSM）只有年度 20-F，采用 `ifrs-full` 科目、新台币计价。
- `companyfacts` 不含分部数据，NVDA 数据中心收入、谷歌云与 AWS 收入需要人工录入或另行解析申报原文。

## 使用边界

- 第一阶段为私有部署、个人使用。FRED 上由 S&P、Nasdaq、ICE 等持有版权的序列只在受登录保护的页面展示，不对外再分发。
- 不使用多个免费账户轮换密钥来扩大额度。
- 盘中快照只用于展示与暂定信号，不写入日线历史；正式值以复权收盘价为准。
- 发布日的追加采集取到新数据即停止，并设置等待上限，遵守各官方来源的访问频率规范。
- TradingView 组件中的数据不能被本系统提取、存储或用于计算。
- 缺失数据显示缺失；替代指标（如 IWM 代替罗素 2000）在页面上标注。

## 参考项目的数据来源

OpenStock（2026-10-25 查看的提交 `855ca6a`）的数据来自 TradingView 嵌入组件与 Finnhub 报价、档案、基本指标、新闻和搜索接口，情绪来自 Adanos，EDGAR 只用于申报链接与代码表。它不保存历史时间序列，也没有宏观数据，因此本项目的数据层自行实现。

## 2026-10-27 首次真实采集

用真实密钥回填全部 1A 序列（72 个），结果写入本机 PostgreSQL：

| 来源 | 序列 | 新增观测 | 用时 |
| --- | --- | --- | --- |
| FRED | 39 | 247,972 | 66 秒 |
| 美国财政部 | 6 | 1,230（2026 年） | 0.6 秒 |
| BLS | 4 | 81 | 0.4 秒 |
| BEA | 2 | 40 | 1.7 秒 |
| Tiingo | 21（7 只 ETF × 收盘、分红、拆股） | 44,424 | 11 秒 |

- 第二次运行新增 0、修订 0，确认重复采集不产生重复记录。
- 全部 72 个序列在预期更新时间内，待确认 0。
- 财政部与 FRED 收益率 2026 年以来逐日一致（容差 0.005 个百分点），0 处不一致。
- BLS 的 CPI、核心 CPI、非农、失业率与 FRED 对应序列在重叠的 20 个月中逐月一致；BEA 核心 PCE 与 FRED `PCEPILFE` 一致。
- 由未复权收盘价、分红与拆股计算的复权价，与 Tiingo 自身复权价相比：平均相对误差 0.004%～0.06%，最大 0.09%（SPY、IWM、SOXX 在 2005～2008 年的个别日期）。
- Finnhub 盘中快照尚未在交易时段实测（采集时美股已收盘）。

## 发布日程（2026-10-27 核对）

| 事件 | 来源 | 时间 |
| --- | --- | --- |
| FOMC 利率决议 | [美联储 FOMC 日历](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)网页解析，会议第二天 | 美东 14:00 |
| PCE | [BEA 发布日历 ICS](https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics) 中的 “Personal Income and Outlays” | 以日历为准（通常 8:30，个别为 10:00） |
| CPI、非农、初请失业金 | FRED 收录的官方发布日期（release 10、50、180） | 按惯例美东 8:30 |

- BLS 网站对程序访问返回 403，因此 BLS 发布日期改取 FRED 收录的官方日程。FRED 目前收录到 2026 年 12 月，BLS 公布 2027 年日程后会随每日同步补上。
- 首次同步 117 个事件；重复同步数量不变。PCE 日期在 BEA 日历与 FRED 中一致（2026-10-29、11-25、12-23）；初请失业金在感恩节当周为周三 11-25。
- 重新同步时，同一类别中以后的、已不在官方日程里的事件视为改期并删除；人工录入的财报日期不受影响。解析失败时保留已有日程。
