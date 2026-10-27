import { easternMinutes, isMarketOpen, isTradingDay, easternDate } from "./calendar";

// 调度决策纯函数：worker 每分钟调用一次，根据当前时刻与上次运行时间决定要跑哪些任务

export type Trigger =
  | { kind: "daily"; easternTime: string; tradingDaysOnly?: boolean } // 每天在美东某时刻之后运行一次
  | { kind: "interval"; minutes: number } // 固定间隔
  | { kind: "market-hours"; minutes: number } // 只在美股交易时段内按间隔运行
  | { kind: "window"; start: string; end: string; minutes: number; tradingDaysOnly?: boolean }; // 美东某时段内按间隔运行

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

export function isDue(trigger: Trigger, now: Date, lastRun: Date | undefined): boolean {
  switch (trigger.kind) {
    case "interval":
      return !lastRun || now.getTime() - lastRun.getTime() >= trigger.minutes * 60_000;
    case "market-hours":
      return isMarketOpen(now) && (!lastRun || now.getTime() - lastRun.getTime() >= trigger.minutes * 60_000);
    case "window": {
      if (trigger.tradingDaysOnly && !isTradingDay(easternDate(now))) return false;
      const m = easternMinutes(now);
      if (m < toMinutes(trigger.start) || m >= toMinutes(trigger.end)) return false;
      return !lastRun || now.getTime() - lastRun.getTime() >= trigger.minutes * 60_000;
    }
    case "daily": {
      const today = easternDate(now);
      if (trigger.tradingDaysOnly && !isTradingDay(today)) return false;
      if (easternMinutes(now) < toMinutes(trigger.easternTime)) return false;
      return !lastRun || easternDate(lastRun) < today || easternMinutes(lastRun) < toMinutes(trigger.easternTime);
    }
  }
}

// 发布日追加采集：从发布时刻起按间隔轮询，取到新数据或超过等待上限即停止
export type ReleasePollDecision = "wait" | "poll" | "done" | "give_up";

export function releasePoll(
  release: { scheduledAt: Date; intervalMinutes: number; maxWaitMinutes: number },
  now: Date,
  lastPoll: Date | undefined,
  arrived: boolean,
): ReleasePollDecision {
  if (arrived) return "done";
  if (now < release.scheduledAt) return "wait";
  if (now.getTime() - release.scheduledAt.getTime() > release.maxWaitMinutes * 60_000) return "give_up";
  if (!lastPoll || lastPoll < release.scheduledAt) return "poll";
  return now.getTime() - lastPoll.getTime() >= release.intervalMinutes * 60_000 ? "poll" : "wait";
}

// 盘中快照的请求预算：每分钟请求数不超过供应商额度的安全比例
export const INTRADAY_SAFETY_RATIO = 0.8;

export function intradayRequestsPerMinute(symbolCount: number, intervalMinutes: number): number {
  return symbolCount / intervalMinutes;
}

export function checkIntradayBudget(symbolCount: number, intervalMinutes: number, limitPerMinute: number) {
  const perMinute = intradayRequestsPerMinute(symbolCount, intervalMinutes);
  const allowed = limitPerMinute * INTRADAY_SAFETY_RATIO;
  return {
    ok: perMinute <= allowed,
    perMinute,
    allowed,
    message:
      perMinute <= allowed
        ? `每分钟约 ${perMinute.toFixed(1)} 次请求，在额度 ${limitPerMinute} 次的 ${INTRADAY_SAFETY_RATIO * 100}% 以内`
        : `每分钟约 ${perMinute.toFixed(1)} 次请求，超过额度 ${limitPerMinute} 次的 ${INTRADAY_SAFETY_RATIO * 100}%；请减少代码或拉长间隔`,
  };
}
