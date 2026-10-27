import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// 序列定义：每个序列的来源、单位与校验、时效参数
export const series = pgTable("series", {
  id: text("id").primaryKey(), // 例如 fred:DGS10
  source: text("source").notNull(),
  sourceKey: text("source_key").notNull(),
  nameZh: text("name_zh").notNull(),
  unit: text("unit").notNull(),
  frequency: text("frequency").notNull(), // daily | weekly | monthly | quarterly | annual
  seasonalAdjustment: text("seasonal_adjustment"),
  category: text("category").notNull(),
  copyrightHolder: text("copyright_holder"),
  validMin: doublePrecision("valid_min"),
  validMax: doublePrecision("valid_max"),
  jumpSigma: doublePrecision("jump_sigma"),
  releaseLagDays: integer("release_lag_days"),
  timelinessTargetMinutes: integer("timeliness_target_minutes"),
  calendar: text("calendar"), // nyse | weekdays，用于检查日度序列缺口
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const observations = pgTable(
  "observations",
  {
    seriesId: text("series_id").notNull().references(() => series.id),
    obsDate: date("obs_date").notNull(),
    value: doublePrecision("value").notNull(),
    sourceRef: text("source_ref").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.seriesId, t.obsDate] })],
);

// 未通过校验的观测单独存放，不覆盖已通过检查的值；确认后才并入 observations
export const pendingObservations = pgTable(
  "pending_observations",
  {
    seriesId: text("series_id").notNull().references(() => series.id),
    obsDate: date("obs_date").notNull(),
    value: doublePrecision("value").notNull(),
    unit: text("unit").notNull(),
    sourceRef: text("source_ref").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    issues: jsonb("issues").notNull(),
  },
  (t) => [primaryKey({ columns: [t.seriesId, t.obsDate] })],
);

export const observationRevisions = pgTable(
  "observation_revisions",
  {
    id: serial("id").primaryKey(),
    seriesId: text("series_id").notNull().references(() => series.id),
    obsDate: date("obs_date").notNull(),
    previousValue: doublePrecision("previous_value").notNull(),
    previousFetchedAt: timestamp("previous_fetched_at", { withTimezone: true }).notNull(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("observation_revisions_series_date").on(t.seriesId, t.obsDate)],
);

// 盘中快照只用于展示与暂定信号，不进入日线历史
export const intradaySnapshots = pgTable(
  "intraday_snapshots",
  {
    symbol: text("symbol").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    price: doublePrecision("price").notNull(),
    providerTs: timestamp("provider_ts", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.capturedAt] })],
);

export const derivedValues = pgTable(
  "derived_values",
  {
    derivedId: text("derived_id").notNull(),
    obsDate: date("obs_date").notNull(),
    value: doublePrecision("value"), // 输入不完整时为空
    formulaVersion: integer("formula_version").notNull(),
    inputStatus: text("input_status").notNull(), // ok | missing | pending_review | stale
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.derivedId, t.obsDate] })],
);

export const filings = pgTable("filings", {
  accessionNo: text("accession_no").primaryKey(),
  cik: text("cik").notNull(),
  form: text("form").notNull(),
  periodEnd: date("period_end"),
  filedAt: date("filed_at").notNull(),
  url: text("url").notNull(),
});

export const companies = pgTable("companies", {
  symbol: text("symbol").primaryKey(),
  cik: text("cik").notNull(),
  name: text("name").notNull(),
  fiscalYearEndMonth: integer("fiscal_year_end_month").notNull(),
  conceptMapVersion: text("concept_map_version"),
});

export const universeMembers = pgTable("universe_members", {
  symbol: text("symbol").primaryKey(),
  layer: text("layer").notNull(),
  cyclicality: text("cyclicality").notNull(), // strong | medium | growth
  inHyperscalerCapex: boolean("in_hyperscaler_capex").notNull().default(false),
  active: boolean("active").notNull().default(true),
  addedAt: createdAt(),
});

export const universeChanges = pgTable("universe_changes", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  action: text("action").notNull(), // add | remove | update
  before: jsonb("before"),
  after: jsonb("after"),
  changedAt: createdAt(),
});

export const manualEntries = pgTable(
  "manual_entries",
  {
    id: serial("id").primaryKey(),
    seriesId: text("series_id").notNull().references(() => series.id),
    obsDate: date("obs_date").notNull(),
    value: doublePrecision("value").notNull(),
    unit: text("unit").notNull(),
    sourceUrl: text("source_url").notNull(),
    note: text("note"),
    version: integer("version").notNull().default(1),
    isCurrent: boolean("is_current").notNull().default(true),
    enteredAt: createdAt(),
  },
  (t) => [index("manual_entries_series_date").on(t.seriesId, t.obsDate)],
);

export const signalRuleOverrides = pgTable("signal_rule_overrides", {
  id: serial("id").primaryKey(),
  ruleId: text("rule_id").notNull(),
  params: jsonb("params").notNull(),
  changedAt: createdAt(),
});

export const signalStates = pgTable(
  "signal_states",
  {
    id: serial("id").primaryKey(),
    ruleId: text("rule_id").notNull(),
    state: text("state").notNull(), // normal | watch | warning | insufficient
    previousState: text("previous_state"),
    inputs: jsonb("inputs").notNull(),
    ruleVersion: integer("rule_version").notNull(),
    changedAt: createdAt(),
  },
  (t) => [index("signal_states_rule").on(t.ruleId, t.changedAt)],
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(), // 例如 cpi:2026-11-10、earnings:NVDA:2026-11-19，保证重复导入不产生重复事件
    origin: text("origin").notNull().default("official"), // official（官方日程导入）| manual（人工录入）
    kind: text("kind").notNull(), // fomc | cpi | nfp | pce | claims | earnings
    title: text("title").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    sourceUrl: text("source_url").notNull(),
    confirmed: boolean("confirmed").notNull().default(true),
    seriesIds: text("series_ids").array().notNull().default([]),
    status: text("status").notNull().default("scheduled"), // scheduled | released | delayed
    note: text("note"), // 例如“时间按惯例 8:30 推算”
  },
  (t) => [index("events_scheduled_at").on(t.scheduledAt)],
);

export const ingestRuns = pgTable(
  "ingest_runs",
  {
    id: serial("id").primaryKey(),
    job: text("job").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status").notNull(), // running | success | failed | skipped
    rowsWritten: integer("rows_written").notNull().default(0),
    latencySeconds: integer("latency_seconds"),
    error: text("error"),
  },
  (t) => [index("ingest_runs_job").on(t.job, t.startedAt)],
);

// 服务端会话：退出时撤销，旧 Cookie 立即失效
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: serial("id").primaryKey(),
    sourceKey: text("source_key").notNull(),
    success: boolean("success").notNull(),
    attemptedAt: createdAt(),
  },
  (t) => [index("login_attempts_source").on(t.sourceKey, t.attemptedAt)],
);

export const workerHeartbeat = pgTable("worker_heartbeat", {
  id: text("id").primaryKey(),
  beatAt: timestamp("beat_at", { withTimezone: true }).notNull(),
});
