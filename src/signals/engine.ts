import { and, desc, eq, gt, inArray } from "drizzle-orm";
import type { Db } from "@/db/types";
import { pendingObservations, signalRuleOverrides, signalStates } from "@/db/schema";
import { readDerived } from "@/jobs/derive";
import { sourceMeta } from "@/macro/build";
import { latestPrice } from "@/pipeline/intraday";
import { readSeries } from "@/pipeline/store";
import type { Point } from "@/pipeline/derived";
import { defaultParams, RULES, triggerDates, type DailyState, type ParamValues, type RuleDef, type State } from "./rules";
import { forwardStats, summarize } from "./track";

export type DisplayState = State | "insufficient";

export interface Evaluation {
  rule: RuleDef;
  params: ParamValues;
  overridden: boolean;
  state: DisplayState;
  reason: string | null; // 数据不足的原因
  current: DailyState | null;
  change: number | null; // 与约 3 个月前的数值差
  provisional: { state: State; value: number; capturedAt: Date } | null;
  history: DailyState[];
}

export async function currentParams(db: Db, rule: RuleDef): Promise<{ params: ParamValues; overridden: boolean }> {
  const [row] = await db.select().from(signalRuleOverrides).where(eq(signalRuleOverrides.ruleId, rule.id)).orderBy(desc(signalRuleOverrides.id)).limit(1);
  const defaults = defaultParams(rule);
  if (!row) return { params: defaults, overridden: false };
  const params = { ...defaults, ...(row.params as ParamValues) };
  return { params, overridden: Object.keys(defaults).some((k) => params[k] !== defaults[k]) };
}

export class ParamError extends Error {}

// 保存阈值覆盖：只接受规则登记过的参数且必须是有限数值；历史记录全部保留
export async function saveParams(db: Db, ruleId: string, raw: Record<string, string>) {
  const rule = RULES.find((r) => r.id === ruleId);
  if (!rule) throw new ParamError("未知规则");
  const params: ParamValues = {};
  for (const [key, spec] of Object.entries(rule.params)) {
    const value = Number(raw[key]);
    if (raw[key] === undefined || raw[key].trim() === "" || !Number.isFinite(value)) throw new ParamError(`“${spec.label}”必须是数值`);
    params[key] = value;
  }
  await db.insert(signalRuleOverrides).values({ ruleId, params });
  return params;
}

async function loadInputs(db: Db, rule: RuleDef): Promise<Record<string, Point[]>> {
  const entries = await Promise.all(
    rule.inputs.map(async (i) => [i.key, i.derived ? await readDerived(db, i.derived) : (await readSeries(db, i.series!)).map((r) => ({ date: r.obsDate, value: r.value }))] as const),
  );
  return Object.fromEntries(entries);
}

// 输入缺失、过期，或最新一期仍待确认时，信号显示数据不足
async function dataProblem(db: Db, rule: RuleDef, now: Date): Promise<string | null> {
  const metas = await sourceMeta(db, rule.provenance, now);
  for (const m of metas) {
    if (m.state === "empty") return `${m.nameZh} 暂无数据`;
    if (m.state === "stale") return `${m.nameZh} 已过期（最新 ${m.lastObsDate}，最晚应于 ${m.expectedBy} 更新）`;
    if (m.lastObsDate) {
      const newer = await db
        .select({ d: pendingObservations.obsDate })
        .from(pendingObservations)
        .where(and(eq(pendingObservations.seriesId, m.id), gt(pendingObservations.obsDate, m.lastObsDate)))
        .limit(1);
      if (newer.length) return `${m.nameZh} 最新一期（${newer[0]!.d}）待确认`;
    }
  }
  if (metas.length < rule.provenance.length) return "输入序列未登记";
  return null;
}

export async function evaluateRule(db: Db, rule: RuleDef, now = new Date()): Promise<Evaluation> {
  const { params, overridden } = await currentParams(db, rule);
  const history = rule.evaluate(await loadInputs(db, rule), params);
  const current = history.at(-1) ?? null;
  const reason = current ? await dataProblem(db, rule, now) : "历史数据不足以计算";
  const earlier = history.length > 63 ? history[history.length - 64]! : null;

  let provisional: Evaluation["provisional"] = null;
  if (rule.priceBased && rule.id === "spy-200dma" && !reason) {
    const view = await latestPrice(db, "SPY", "tiingo:SPY:close", now);
    const ma = (await readDerived(db, "sma200:SPY")).at(-1)?.value;
    if (view.kind === "provisional" && ma) {
      const gap = (view.price / ma - 1) * 100;
      provisional = { value: gap, capturedAt: view.capturedAt, state: gap < 0 ? "warning" : gap < params.watch! ? "watch" : "normal" };
    }
  }

  return {
    rule,
    params,
    overridden,
    state: reason ? "insufficient" : current!.state,
    reason,
    current,
    change: current && earlier ? current.value - earlier.value : null,
    provisional,
    history,
  };
}

export async function evaluateAll(db: Db, now = new Date()) {
  return Promise.all(RULES.map((r) => evaluateRule(db, r, now)));
}

// 只记录收盘确认后的状态变化；盘中暂定状态不写入日志
export async function logStateChanges(db: Db, evaluations: Evaluation[]) {
  const ids = evaluations.map((e) => e.rule.id);
  const logged = await db.select().from(signalStates).where(inArray(signalStates.ruleId, ids)).orderBy(desc(signalStates.id));
  const changes: string[] = [];
  for (const e of evaluations) {
    const last = logged.find((l) => l.ruleId === e.rule.id);
    if (last?.state === e.state) continue;
    await db.insert(signalStates).values({
      ruleId: e.rule.id,
      state: e.state,
      previousState: last?.state ?? null,
      inputs: { value: e.current?.value ?? null, date: e.current?.date ?? null, params: e.params, reason: e.reason },
      ruleVersion: e.rule.version,
    });
    changes.push(`${e.rule.id}: ${last?.state ?? "（无）"} → ${e.state}`);
  }
  return changes;
}

export async function trackRecord(db: Db, e: Evaluation) {
  const [spy, soxx] = await Promise.all([readDerived(db, "adj:SPY"), readDerived(db, "adj:SOXX")]);
  const rows = triggerDates(e.history).map((date) => ({ date, spy: forwardStats(date, spy), soxx: forwardStats(date, soxx) }));
  return { rows, spy: summarize(rows.map((r) => r.spy)), soxx: summarize(rows.map((r) => r.soxx)), priceStart: { spy: spy[0]?.date ?? null, soxx: soxx[0]?.date ?? null } };
}

export async function stateLog(db: Db, ruleId: string) {
  return db.select().from(signalStates).where(eq(signalStates.ruleId, ruleId)).orderBy(desc(signalStates.id)).limit(50);
}

export async function paramHistory(db: Db, ruleId: string) {
  return db.select().from(signalRuleOverrides).where(eq(signalRuleOverrides.ruleId, ruleId)).orderBy(desc(signalRuleOverrides.id)).limit(20);
}
