import type { ObservationInput, SeriesDef, StoredPoint } from "./types";

export type IssueCode = "out_of_range" | "abnormal_jump" | "unit_mismatch" | "not_finite";

export interface ValidationResult {
  ok: boolean;
  issues: { code: IssueCode; message: string }[];
}

const MIN_HISTORY_FOR_JUMP = 20;

function stdev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

// history：该序列已通过检查的观测，按日期升序，只取新观测之前的部分
export function validateObservation(def: SeriesDef, obs: ObservationInput, history: StoredPoint[]): ValidationResult {
  const issues: ValidationResult["issues"] = [];

  if (!Number.isFinite(obs.value)) issues.push({ code: "not_finite", message: "数值不是有限数" });
  if (obs.unit !== def.unit) issues.push({ code: "unit_mismatch", message: `单位为 ${obs.unit}，登记单位为 ${def.unit}` });
  if ((def.validMin !== undefined && obs.value < def.validMin) || (def.validMax !== undefined && obs.value > def.validMax)) {
    issues.push({ code: "out_of_range", message: `数值 ${obs.value} 超出合理范围 [${def.validMin ?? "-∞"}, ${def.validMax ?? "+∞"}]` });
  }

  const prior = history.filter((p) => p.obsDate < obs.obsDate);
  if (def.jumpSigma !== undefined && prior.length >= MIN_HISTORY_FOR_JUMP) {
    const recent = prior.slice(-60);
    const diffs = recent.slice(1).map((p, i) => p.value - recent[i]!.value);
    const sigma = stdev(diffs);
    const change = obs.value - recent[recent.length - 1]!.value;
    if (sigma > 0 && Math.abs(change) > def.jumpSigma * sigma) {
      issues.push({ code: "abnormal_jump", message: `单期变化 ${change.toPrecision(4)} 超过近期波动的 ${def.jumpSigma} 倍` });
    }
  }

  return { ok: issues.length === 0, issues };
}
