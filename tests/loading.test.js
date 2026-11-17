// Synthetic performance fixtures, not imported athlete history.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as M from "../src/model.js";
import * as C from "../src/calculations.js";
import { RTS, rtsPercent, rtsEstimate } from "../src/rts.js";
const p = JSON.parse(
  fs.readFileSync(new URL("../data/program.json", import.meta.url)),
);
const main = (week = 2) =>
  p.sessions
    .find((s) => s.week === week && s.day === "Monday" && s.athlete === "z")
    .exercises.find((e) => e.top);
const record = (extra = {}) => ({
  id: "synthetic-top",
  type: "set",
  athlete: "z",
  exerciseId: "barbell-z-press",
  variant: "barbell-z-press",
  unit: "lb total",
  sessionId: "synthetic",
  date: "2026-01-01",
  slot: 0,
  status: "done",
  load: 125,
  reps: 5,
  rpe: 7.5,
  rir: null,
  ...extra,
});
const data = (x) => M.updateRecord(M.fresh(), record(x));
test("RTS transcription has 96 cells and verified representative values", () => {
  assert.equal(Object.values(RTS).flat().length, 96);
  for (const [reps, rpe, expected] of [
    [1, 10, 100],
    [2, 9.5, 93.9],
    [3, 9, 89.2],
    [4, 8.5, 85],
    [5, 8, 81.1],
    [5, 7.5, 79.9],
    [6, 7, 76.2],
    [12, 6.5, 58.6],
    [10, 10, 73.9],
    [11, 8, 65.3],
  ])
    assert.equal(rtsPercent(reps, rpe), expected);
});
test("125 × 5 @ 7.5 estimates about 156 lb and next 5 @ 8 suggests 125–130", () => {
  const d = data(),
    before = M.canonical(d),
    e = main(),
    original = M.canonical(e),
    r = C.loading(d, "z", e);
  assert.ok(Math.abs(r.estimateRange[0] - 156.45) < 0.01);
  assert.deepEqual(r.range, [125, 130]);
  assert.equal(r.targetPercent, 81.1);
  assert.deepEqual(r.referenceRange, [110, 120]);
  assert.equal(M.canonical(d), before);
  assert.equal(M.canonical(e), original);
});
test("comparable exposures across loads and RPE 7–8 do not unjustifiably regress", () => {
  for (const load of [75, 100, 125, 150])
    for (const rpe of [7, 7.5, 8]) {
      const r = C.loading(data({ load, rpe }), "z", main());
      assert.ok(r.range[0] >= load);
      if (rpe === 8) assert.deepEqual(r.range, [load, load]);
    }
});
test("reported effort range propagates uncertainty without choosing a fabricated actual RPE", () => {
  const d = data({ rpe: null, rpeRange: [7, 8] }),
    r = C.loading(d, "z", main());
  assert.deepEqual(r.range, [125, 130]);
  assert.ok(r.estimateRange[0] < r.estimateRange[1]);
  assert.equal(d.records[0].rpe, null);
});
test("half-point target RPE uses the exact table cell and equipment rounding", () => {
  const e = { ...main(), rpeCap: 8.5 };
  const r = C.loading(data(), "z", e, 2.5);
  assert.equal(r.targetPercent, 82.4);
  assert.deepEqual(r.range, [127.5, 130]);
});
test("higher-rep targets and easier intensities retain legitimate reductions", () => {
  const e = main();
  const higher = { ...e, top: { ...e.top, reps: 8 } };
  assert.ok(C.loading(data(), "z", higher).range[1] < 125);
  const easier = C.loading(data({ rpe: 7 }), "z", main(4));
  assert.deepEqual(easier.range, [125, 125]);
  const over = C.loading(data({ rpe: 8 }), "z", main(4));
  assert.equal(over.range, null);
  assert.match(over.source, /Reduce/);
});
test("no chart interpolation, extrapolation or prescribed-effort substitution", () => {
  for (const [reps, rpe] of [
    [0, 8],
    [13, 8],
    [5, 6],
    [5, 7.25],
    [2.5, 8],
  ])
    assert.equal(rtsPercent(reps, rpe), null);
  for (const extra of [
    { rpe: null },
    { rpe: null, rir: 2 },
    { rpe: 6 },
    { reps: 13 },
  ])
    assert.equal(C.loading(data(extra), "z", main()).range, null);
  assert.equal(C.loading(data(), "z", { ...main(), rpeCap: 6 }).range, null);
});
test("chart handles twelve reps without Epley ten-rep truncation", () => {
  const r = C.loading(data({ reps: 12, rpe: 8 }), "z", main());
  assert.equal(r.method, "RTS");
  assert.ok(r.estimateRange[0] > 190);
});
test("strength estimates remain scoped to athlete, exact variation, unit and top set", () => {
  for (const patch of [
    { athlete: "h" },
    { variant: "other-press" },
    { unit: "lb per hand" },
    { status: "skipped" },
    { slot: 1 },
  ]) {
    const d = data();
    const next = M.updateRecord(
      d,
      record({ id: "other", load: 200, date: "2026-01-02", ...patch }),
    );
    assert.deepEqual(C.loading(next, "z", main()), C.loading(d, "z", main()));
  }
});
test("chart excludes carries, sleds, explosive cleans and device settings", () => {
  for (const variant of [
    "heavy-sandbag-front-carry",
    "sled-push",
    "hang-power-clean",
    "voltra-sled-pull-mode",
    "push-press",
    "db-push-press",
  ])
    assert.equal(rtsEstimate(record({ variant })), null);
  assert.equal(rtsEstimate(record({ unit: "device setting" })), null);
});
test("actual RPE ranges validate and survive backup roundtrip without changing earlier records", () => {
  const d = data({ rpe: null, rpeRange: [7, 8] });
  assert.deepEqual(
    M.importData(M.fresh(), M.safeParse(JSON.stringify(d))).data.records,
    d.records,
  );
  for (const extra of [
    { rpeRange: [7, 8] },
    { rpe: null, rpeRange: [8, 7] },
    { rpe: null, rpeRange: [7] },
  ])
    assert.throws(() => data(extra));
});
test("actual top-based backoffs and accessory double progression are unaffected", () => {
  assert.deepEqual(C.backoff(125, main()), [110, 115]);
  const e = p.sessions[0].exercises.find((e) => e.group === "C1");
  assert.match(
    C.doubleProgression(
      e,
      Array.from({ length: 3 }, () => ({
        status: "done",
        load: 50,
        unit: e.loadUnit,
        reps: 10,
        rir: 2,
      })),
    ),
    /Increase/,
  );
});

test("approved lower-cap week recalculates from a successful prior session snapshot", () => {
  const d = data({ rpe: 8, prescriptionSnapshot: main() });
  const r = C.loading(d, "z", main(4));
  assert.equal(r.method, "RTS");
  assert.ok(r.range[0] < 125);
  assert.equal(r.targetPercent, 78.6);
});
