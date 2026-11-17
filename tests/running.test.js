import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as M from "../src/model.js";
import * as D from "../src/drafts.js";
import * as C from "../src/calculations.js";
import * as R from "../src/running.js";
const p = JSON.parse(
  fs.readFileSync(new URL("../data/program.json", import.meta.url)),
);
const date = "2026-01-06";
const s = p.sessions.find(
  (s) => s.athlete === "z" && s.week === 1 && s.day === "Tuesday",
);
const e = s.exercises.find((e) => !e.warmup),
  slots = M.setSlots(e);
const edit = (d, i, k, v, ss = s, ex = e) =>
  D.editDraft(d, p, ss, ex, M.setSlots(ex)[i], k, v, date);
const finish = (d, ss = s) =>
  D.finishWorkout(
    d,
    p,
    ss,
    date,
    C.activeReference(d, ss.athlete, p.paceDefaults),
  );
const rows = (d) => slots.map((slot) => D.row(d, s, e, slot, date));
const sets = (d) => d.records.filter((r) => r.type === "set");
const example = () => {
  let d = M.fresh();
  for (const [i, [distance, pace, hr]] of [
    ["0.66", "7:29", "160"],
    ["0.67", "7:27", "162"],
    ["0.68", "7:20", "164"],
  ].entries()) {
    d = edit(d, i, "distance", distance);
    d = edit(d, i, "pace", pace);
    d = edit(d, i, "averageHr", hr);
  }
  return d;
};
test("pace and elapsed parsers validate watch formats without estimating performance", () => {
  assert.equal(R.parsePace("7:29"), 449);
  assert.equal(R.parsePace("07:27"), 447);
  assert.equal(R.parsePace("12:05"), 725);
  assert.equal(R.parsePace(""), null);
  for (const v of ["7:60", "7:5", "7.29", "0:00", "-7:29", "100:00", "NaN"])
    assert.throws(() => R.parsePace(v));
  assert.equal(R.parseElapsed("13:43"), 823);
  assert.equal(R.parseElapsed("1:05:04"), 3904);
  assert.equal(R.parseElapsed("0:04.2"), 4.2);
  assert.equal(R.formatElapsed(4.2), "0:04.2");
  assert.equal(R.parseElapsed(""), null);
  assert.throws(() => R.parseElapsed("1:60:00"));
});
test("Week 1 Tuesday stores all three watch intervals with the approved work/recovery unchanged", () => {
  const before = M.canonical(p),
    d = finish(example());
  assert.equal(e.prescription, "3 x 5 min");
  assert.equal(e.rest, "75 sec easy jog");
  assert.equal(
    R.planTiming(e),
    "Prescribed work 5:00 · Recovery 1:15 easy jog",
  );
  assert.deepEqual(
    sets(d).map((r) => [
      r.distance,
      r.distanceUnit,
      r.averagePaceSecondsPerMile,
      r.averageHr,
      r.seconds,
      r.rpe,
    ]),
    [
      [0.66, "mi", 449, 160, null, null],
      [0.67, "mi", 447, 162, null, null],
      [0.68, "mi", 440, 164, null, null],
    ],
  );
  assert.ok(sets(d).every((r) => !r.elapsedTimeSource));
  assert.equal(M.canonical(p), before);
  assert.equal(sets(d).length, 3);
  assert.ok(sets(d).every((r) => !r.prescriptionSnapshot.warmup));
  assert.deepEqual(C.runReferences(d, "z"), []);
  assert.equal(
    C.activeReference(d, "z", p.paceDefaults).value,
    p.paceDefaults.z.value,
  );
});
test("distance and pace propagate independently forward, HR and elapsed time never propagate", () => {
  let d = edit(M.fresh(), 0, "distance", "0.66");
  d = edit(d, 0, "pace", "7:29");
  d = edit(d, 0, "averageHr", "160");
  d = edit(d, 1, "pace", "7:27");
  d = edit(d, 1, "elapsedTime", "4:58");
  assert.deepEqual(
    rows(d).map((r) => [r.distance, r.pace, r.averageHr, r.elapsedTime ?? ""]),
    [
      ["0.66", "7:29", "160", ""],
      ["0.66", "7:27", "", "4:58"],
      ["0.66", "7:27", "", ""],
    ],
  );
  d = edit(d, 2, "distance", "0.68");
  assert.deepEqual(
    rows(d).map((r) => r.distance),
    ["0.66", "0.66", "0.68"],
  );
  d = edit(d, 0, "distance", "0.65");
  assert.deepEqual(
    rows(d).map((r) => r.distance),
    ["0.65", "0.65", "0.65"],
  );
});
test("mixed distance units, variants and finalized rows bound propagation", () => {
  let d = edit(M.fresh(), 1, "distanceUnit", "m");
  d = edit(d, 0, "distance", ".66");
  assert.deepEqual(
    rows(d).map((r) => r.distance),
    [".66", "", ".66"],
  );
  d = edit(d, 2, "variant", "different-run");
  d = edit(d, 0, "pace", "7:29");
  assert.deepEqual(
    rows(d).map((r) => r.pace),
    ["7:29", "", ""],
  );
  const done = finish(example());
  const before = M.clone(done.records);
  d = edit(done, 0, "pace", "7:25");
  assert.deepEqual(
    rows(d).map((r) => r.pace),
    ["7:25", "7:27", "7:20"],
  );
  assert.deepEqual(d.records, before);
  const correction = finish(d);
  assert.ok(
    correction.revisions.some(
      (v) => v.record.averagePaceSecondsPerMile === 449,
    ),
  );
});
test("watch rounding discrepancies are preserved and never recompute a supplied measurement", () => {
  let d = example();
  d = edit(d, 0, "elapsedTime", "5:00");
  d = finish(d);
  const r = sets(d)[0];
  assert.equal(r.seconds, 300);
  assert.equal(r.distance, 0.66);
  assert.equal(r.averagePaceSecondsPerMile, 449);
  assert.equal(r.elapsedTimeSource, "recorded");
  assert.notEqual(r.distance * r.averagePaceSecondsPerMile, r.seconds);
});
test("new measurements validate on Finish/import while partial drafts remain autosavable", () => {
  for (const [field, value] of [
    ["pace", "7:99"],
    ["averageHr", "0"],
    ["averageHr", "301"],
    ["averageHr", "160.5"],
    ["distance", "-1"],
    ["distance", "0"],
    ["distanceUnit", "km"],
    ["elapsedTime", "0:00"],
  ]) {
    const d = edit(example(), 1, field, value);
    M.validateStore(d);
    assert.throws(() => finish(d), undefined, `${field}:${value}`);
  }
  const valid = finish(example());
  for (const patch of [
    { averageHr: NaN },
    { averagePaceSecondsPerMile: -1 },
    { averagePaceSecondsPerMile: 449.5 },
    { distanceUnit: "km" },
  ]) {
    const bad = M.clone(valid);
    Object.assign(sets(bad)[0], patch);
    assert.throws(() => M.importData(M.fresh(), bad));
  }
  let blank = example();
  blank = edit(blank, 1, "averageHr", "");
  assert.equal(sets(finish(blank))[1].averageHr, null);
  assert.ok(
    rows(M.fresh()).every(
      (r) =>
        r.distance === "" &&
        r.pace === "" &&
        r.averageHr === "" &&
        r.seconds === "" &&
        r.rpe === "",
    ),
  );
});
test("all 48 active running sessions for both athletes preserve prescriptions and units", () => {
  const runs = p.sessions.filter((s) =>
    s.exercises.some((e) => e.kind === "run" && !e.warmup),
  );
  assert.equal(runs.length, 48);
  for (const ss of runs) {
    let d = M.fresh();
    const work = ss.exercises.filter((e) => !e.warmup);
    for (const ex of work) {
      const meter = /\bm\b/.test(ex.prescription);
      assert.equal(
        D.row(d, ss, ex, M.setSlots(ex)[0], date).distanceUnit,
        meter ? "m" : "mi",
      );
      for (const [i, slot] of M.setSlots(ex).entries()) {
        d = edit(d, i, "distance", meter ? "800" : "2", ss, ex);
        d = edit(d, i, "pace", "7:29", ss, ex);
        if (R.isTimeTrial(ex)) d = edit(d, i, "elapsedTime", "14:58", ss, ex);
      }
    }
    const done = finish(d, ss);
    assert.equal(
      sets(done).length,
      work.reduce((n, e) => n + e.sets, 0),
    );
    assert.ok(
      sets(done).every((r) => r.athlete === ss.athlete && r.averageHr === null),
    );
    assert.deepEqual(
      done.records.find((r) => r.type === "session").prescriptionSnapshot,
      ss,
    );
    assert.equal(
      C.runReferences(done, ss.athlete).length,
      work.some(R.isTimeTrial) ? 1 : 0,
    );
  }
});
test("two-mile trials require actual finishing time and preserve VDOT validation and pins", () => {
  const ss = p.sessions.find(
      (s) => s.athlete === "h" && s.week === 1 && s.day === "Tuesday",
    ),
    ex = ss.exercises.find((e) => !e.warmup);
  let d = edit(M.fresh(), 0, "distance", "2", ss, ex);
  d = edit(d, 0, "pace", "7:29", ss, ex);
  assert.throws(() => finish(d, ss), /actual two-mile finishing time/);
  d = edit(d, 0, "elapsedTime", "14:58", ss, ex);
  let done = finish(d, ss);
  assert.equal(sets(done)[0].seconds, 898);
  assert.equal(C.runReferences(done, "h")[0].value, C.vdot(3218.69, 898));
  assert.equal(
    C.activeReference(done, "h", p.paceDefaults).value,
    C.vdot(3218.69, 898),
  );
  done.settings["pace:h"] = "program";
  assert.equal(
    C.activeReference(done, "h", p.paceDefaults).value,
    p.paceDefaults.h.value,
  );
  d = edit(d, 0, "distance", "1.9", ss, ex);
  assert.equal(C.runReferences(finish(d, ss), "h").length, 0);
});
test("draft reload/Undo, legacy drafts, revisions and athlete-scoped backups retain new metrics", () => {
  let d = example();
  const raw = JSON.stringify(d),
    restored = M.importData(M.fresh(), JSON.parse(raw)).data;
  assert.deepEqual(restored.drafts, d.drafts);
  assert.equal(rows(D.undoDraft(restored, s))[2].averageHr, "");
  const h = p.sessions.find(
      (s) => s.week === 2 && s.day === "Tuesday" && s.athlete === "h",
    ),
    he = h.exercises.find((e) => !e.warmup);
  d = edit(d, 0, "pace", "9:00", h, he);
  const scoped = M.importData(M.fresh(), d, ["z"]).data;
  assert.deepEqual(Object.keys(scoped.drafts), [s.id]);
  const done = finish(example());
  assert.deepEqual(M.importData(M.fresh(), done).data.records, done.records);
  const legacy = M.clone(done);
  for (const r of sets(legacy)) {
    delete r.runMetricsVersion;
    delete r.averageHr;
    delete r.averagePaceSecondsPerMile;
    r.seconds = 300.125;
  }
  const old = M.canonical(legacy.records);
  M.validateStore(legacy);
  assert.equal(rows(legacy)[0].pace, "");
  assert.equal(M.canonical(legacy.records), old);
  let correction = edit(legacy, 0, "averageHr", "160");
  correction = finish(correction);
  assert.equal(sets(correction)[0].seconds, 300.125);
  assert.deepEqual(
    correction.revisions.find((v) => v.record.type === "set").record,
    sets(legacy)[0],
  );
  const draft = edit(M.fresh(), 0, "seconds", "300");
  for (const r of Object.values(draft.drafts[s.id].sets)) {
    delete r.pace;
    delete r.averageHr;
    delete r.distanceUnit;
  }
  M.validateStore(draft);
  assert.equal(rows(draft)[0].seconds, "300");
  assert.equal(rows(draft)[0].pace, "");
});
