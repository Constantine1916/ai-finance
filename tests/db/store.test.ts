import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { observationRevisions, observations, pendingObservations } from "@/db/schema";
import { confirmPending, discardPending, readSeries, TraceabilityError, upsertSeries, writeObservations } from "@/pipeline/store";
import type { SeriesDef } from "@/pipeline/types";
import { testDb } from "./helpers";

const { db, close } = testDb();
afterAll(close);

const def = (id: string): SeriesDef => ({ id, source: "fred", sourceKey: id, nameZh: id, unit: "Percent", frequency: "daily", category: "rates", validMin: 0, validMax: 20, jumpSigma: 6 });
const obs = (obsDate: string, value: number, fetchedAt = new Date()) => ({ obsDate, value, unit: "Percent", sourceRef: "https://example.org/src", fetchedAt });

const ids = ["t:trace", "t:idem", "t:range", "t:jump", "t:confirm"];
beforeAll(() => upsertSeries(db, ids.map(def)));

describe("writeObservations", () => {
  it("refuses observations missing traceability fields", async () => {
    await expect(writeObservations(db, def("t:trace"), [{ ...obs("2026-10-01", 4), sourceRef: "" }])).rejects.toThrow(TraceabilityError);
    await expect(writeObservations(db, def("t:trace"), [{ ...obs("2026-10-01", 4), fetchedAt: undefined as unknown as Date }])).rejects.toThrow(TraceabilityError);
    expect(await readSeries(db, "t:trace")).toEqual([]);
  });

  it("is idempotent and records revisions", async () => {
    const d = def("t:idem");
    expect(await writeObservations(db, d, [obs("2026-10-01", 4.1), obs("2026-10-02", 4.2)])).toMatchObject({ inserted: 2 });
    expect(await writeObservations(db, d, [obs("2026-10-01", 4.1), obs("2026-10-02", 4.2)])).toMatchObject({ inserted: 0, unchanged: 2 });
    expect(await writeObservations(db, d, [obs("2026-10-02", 4.25)])).toMatchObject({ revised: 1 });
    const revisions = await db.select().from(observationRevisions).where(eq(observationRevisions.seriesId, "t:idem"));
    expect(revisions.map((r) => r.previousValue)).toEqual([4.2]);
    expect((await readSeries(db, "t:idem")).map((p) => p.value)).toEqual([4.1, 4.25]);
  });

  it("keeps the last accepted value when a new value is out of range", async () => {
    const d = def("t:range");
    await writeObservations(db, d, [obs("2026-10-01", 4)]);
    expect(await writeObservations(db, d, [obs("2026-10-01", 40)])).toMatchObject({ pending: 1 });
    expect((await readSeries(db, "t:range"))[0]!.value).toBe(4);
    const [p] = await db.select().from(pendingObservations).where(eq(pendingObservations.seriesId, "t:range"));
    expect((p!.issues as { code: string }[])[0]!.code).toBe("out_of_range");
  });

  it("holds an abnormal jump until a later fetch returns the same value", async () => {
    const d = def("t:jump");
    const history = Array.from({ length: 30 }, (_, i) => obs(`2026-08-${String(i + 1).padStart(2, "0")}`, 4 + (i % 2) * 0.02));
    await writeObservations(db, d, history);
    const first = new Date("2026-10-01T12:00:00Z");
    expect(await writeObservations(db, d, [obs("2026-09-01", 6, first)])).toMatchObject({ pending: 1 });
    expect(await writeObservations(db, d, [obs("2026-09-01", 6.1, new Date("2026-10-01T13:00:00Z"))])).toMatchObject({ pending: 1 });
    expect(await writeObservations(db, d, [obs("2026-09-01", 6.1, new Date("2026-10-01T14:00:00Z"))])).toMatchObject({ inserted: 1, autoAccepted: 1 });
    expect(await db.select().from(pendingObservations).where(eq(pendingObservations.seriesId, "t:jump"))).toEqual([]);
  });

  it("lets the owner confirm or discard pending values", async () => {
    const d = def("t:confirm");
    await writeObservations(db, d, [obs("2026-10-01", 30), obs("2026-10-02", 31)]);
    expect(await confirmPending(db, "t:confirm", "2026-10-01")).toBe(true);
    expect(await discardPending(db, "t:confirm", "2026-10-02")).toBe(true);
    expect(await confirmPending(db, "t:confirm", "2026-10-02")).toBe(false);
    const rows = await db.select().from(observations).where(and(eq(observations.seriesId, "t:confirm")));
    expect(rows.map((r) => [r.obsDate, r.value])).toEqual([["2026-10-01", 30]]);
  });

  it("leaves gaps as gaps rather than filling them", async () => {
    const d = def("t:idem");
    await writeObservations(db, d, [obs("2026-10-06", 4.3)]);
    expect((await readSeries(db, "t:idem")).map((p) => p.obsDate)).toEqual(["2026-10-01", "2026-10-02", "2026-10-06"]);
  });
});
