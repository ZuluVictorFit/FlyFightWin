import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as M from "../src/model.js";
import * as C from "../src/calculations.js";
import { validateProgram } from "../src/program.js";
const program = JSON.parse(
    fs.readFileSync(new URL("../data/program.json", import.meta.url)),
  ),
  s = (w, d, a = "z") =>
    program.sessions.find(
      (s) => s.week === w && s.day === d && s.athlete === a,
    );
const legacy = (z = {}, h = {}) => ({ v: 2, who: "z", z, h });
const row = (extra = {}) => ({
  id: "set:test",
  type: "set",
  athlete: "z",
  exerciseId: "barbell-z-press",
  variant: "barbell-z-press",
  sessionId: "test",
  slot: 0,
  date: "2026-01-01",
  status: "done",
  load: 100,
  reps: 5,
  unit: "lb total",
  ...extra,
});
test("all 112 sessions satisfy validated schema; all 54 source pages represented", () => {
  assert.equal(validateProgram(program), program);
  assert.equal(program.sessions.filter((s) => s.exercises.length).length, 96);
  assert.equal(
    new Set(
      program.sessions
        .filter((s) => s.exercises.length)
        .map((s) => s.sourcePage),
    ).size,
    48,
  );
  assert.equal(program.sessions.flatMap((s) => s.exercises).length, 566);
});
test("all warmups and pairing preserved; lower primer precedes jump and main lift", () => {
  for (let w = 1; w <= 8; w++)
    for (const a of ["z", "h"]) {
      assert.match(s(w, "Monday", a).exercises[1].name, /Lu raise/);
      const wed = s(w, "Wednesday", a).exercises;
      assert.match(wed[1].intensity, /primer|short controlled/);
      assert.equal(wed[4].top.reps, [3, 4, 3, 4, 3, 3, 2, 3][w - 1]);
      assert.equal(wed.filter((e) => e.optional).length, 2);
      assert.ok(wed.filter((e) => e.optional).every((e) => e.sets === 3));
      assert.match(wed[5].rest, /Pair D/);
      assert.match(s(w, "Friday", a).note, /separate efforts/);
    }
});
test("weeks 4 and 8 unload volume without inventing extra sets or strides", () => {
  for (const w of [4, 8])
    for (const a of ["z", "h"]) {
      for (const d of ["Monday", "Wednesday"])
        assert.equal(s(w, d, a).exercises.find((e) => e.top).sets, 3);
      assert.equal(
        s(w, "Friday", a).exercises.find((e) => e.group === "A").sets,
        3,
      );
      assert.equal(s(w, "Thursday", a).exercises.length, 1);
    }
});
test("all quality run work and recoveries match approved progression", () => {
  const z = [
      "3 x 5 min",
      "3 x 6 min",
      "4 x 3 min",
      "6 x 200 m",
      "18 min continuous",
      "4 x 4 min",
      "3 x 800 m",
      "2-mile time trial",
    ],
    h = [
      "2-mile time trial",
      "3 x 5 min",
      "4 x 2 min",
      "6 x 20 sec",
      "3 x 5 min",
      "5 x 2 min",
      "4 x 400 m",
      "2-mile time trial",
    ];
  const zr = [
      "75 sec easy jog",
      "75 sec easy jog",
      "3 min easy jog",
      "200 m walk/jog",
      "No recovery",
      "3 min easy jog",
      "2 min 30 sec easy jog",
      "No recoveries",
    ],
    hr = [
      "No recoveries",
      "90 sec easy jog",
      "2 min easy jog",
      "100 sec walk/jog",
      "90 sec easy jog",
      "2 min easy jog",
      "2 min easy jog",
      "No recoveries",
    ];
  for (let w = 1; w <= 8; w++)
    for (const a of ["z", "h"]) {
      const e = s(w, "Tuesday", a).exercises.find((e) => e.group === "WORK");
      assert.equal(e.prescription, (a === "z" ? z : h)[w - 1]);
      assert.equal(e.rest, (a === "z" ? zr : hr)[w - 1]);
    }
});
test("48 active days per athlete support saving every prescribed working set and side", () => {
  for (const ss of program.sessions) {
    let data = M.fresh();
    for (const e of ss.exercises.filter((e) => !e.warmup))
      for (const slot of M.setSlots(e)) {
        data = M.updateRecord(
          data,
          row({
            id: `set:${ss.id}:${e.id}:${slot.key}`,
            athlete: ss.athlete,
            exerciseId: e.exerciseId,
            variant: e.exerciseId,
            sessionId: ss.id,
            slot: slot.index,
            side: slot.side,
            unit: e.loadUnit,
            prescriptionSnapshot: e,
          }),
        );
      }
    assert.equal(
      data.records.length,
      ss.exercises
        .filter((e) => !e.warmup)
        .reduce((n, e) => n + e.sets * (e.unilateral ? 2 : 1), 0),
    );
    M.validateStore(data);
  }
});
test("Epley limited to 1–10 reps and supported lift identities", () => {
  assert.equal(C.e1rm(100, 6), 120);
  assert.equal(C.e1rm(100, 11), null);
  for (const id of [
    "sled-push",
    "voltra-sled-pull-mode",
    "heavy-sandbag-front-carry",
    "hang-power-clean",
  ])
    assert.equal(C.supportsMax(id), false);
});
test("percentage ranges and backoffs use saved top and equipment rounding", () => {
  const e = s(1, "Monday").exercises.find((e) => e.top);
  assert.deepEqual(C.initialBand(e), [77, 83]);
  assert.deepEqual(C.backoff(100, e, 2.5), [87.5, 90]);
  assert.equal(C.backoff(null, e), null);
  assert.deepEqual(
    C.initialBand(s(4, "Monday").exercises.find((e) => e.top)),
    [72, 78],
  );
});
test("missing lift max never borrows old dissimilar lift test", () => {
  const d = M.importData(
    M.fresh(),
    legacy({ mx: { 1: { pr: 200, sq: 300, hi: 400 } } }),
  ).data;
  assert.equal(
    C.loading(
      d,
      "z",
      s(1, "Monday").exercises.find((e) => e.top),
    ).range,
    null,
  );
});
test("matched performance suggestions do not cross variants, units or athletes", () => {
  let d = M.updateRecord(M.fresh(), row({ variant: "pendlay-row" }));
  assert.equal(C.matchedHistory(d, "z", "barbell-bent-over-row").length, 0);
  assert.equal(C.matchedHistory(d, "h", "pendlay-row").length, 0);
  assert.equal(
    C.matchedHistory(d, "z", "pendlay-row", "lb per hand").length,
    0,
  );
});
test("double progression requires complete sides and explicit RIR", () => {
  const e = s(1, "Monday").exercises.find((e) => e.group === "C1");
  assert.match(C.doubleProgression(e, [row(), row(), row()]), /Hold/);
  const all = [
    row({ reps: 10, rir: 2 }),
    row({ reps: 10, rir: 2 }),
    row({ reps: 10, rir: 2 }),
  ];
  assert.match(C.doubleProgression(e, all, 2.5), /Increase by 2.5/);
  assert.match(C.doubleProgression(e, all.slice(1)), /Hold/);
  all[0].rir = 1;
  assert.match(C.doubleProgression(e, all), /reduce/);
  const u = s(1, "Friday").exercises.find((e) => e.group === "E1");
  assert.match(C.doubleProgression(u, all), /Hold/);
});
test("first migration and repeated imports preserve both athlete records and extras", () => {
  const a = legacy(
    { tt: { 4: { v: 40, s: 450 } }, custom: { x: { unknown: "keep" } } },
    { pt: { 4: { pu: 20 } } },
  );
  const first = M.importData(M.fresh(), a);
  assert.equal(first.added, 3);
  assert.deepEqual(first.data.imports[0].data, a);
  const again = M.importData(first.data, a);
  assert.equal(again.added, 0);
  assert.equal(again.duplicates, 3);
  assert.equal(again.data.imports.length, 1);
});
test("per-athlete import and conflicting legacy values retain all evidence", () => {
  const d = M.importData(
    M.fresh(),
    legacy({ tt: { 4: { v: 40 } } }, { tt: { 4: { v: 30 } } }),
  ).data;
  const r = M.importData(
    d,
    legacy({ tt: { 4: { v: 41 } } }, { tt: { 4: { v: 31 } } }),
    ["h"],
  );
  assert.equal(r.conflicts, 1);
  assert.equal(r.data.records.find((r) => r.athlete === "z").value.v, 40);
  assert.equal(r.data.records.find((r) => r.athlete === "h").value.v, 30);
  const resolved = M.resolveConflict(r.data, 0, true);
  assert.equal(resolved.records.find((r) => r.athlete === "h").value.v, 31);
  assert.equal(resolved.revisions.length, 1);
});
test("v3 roundtrip, edits and merges retain prior versions and flag concurrent edits", () => {
  let d = M.updateRecord(M.fresh(), row());
  d = M.updateRecord(d, row({ reps: 6 }));
  assert.equal(d.revisions[0].record.reps, 5);
  const imported = M.importData(M.fresh(), M.safeParse(JSON.stringify(d))).data;
  assert.deepEqual(imported.records, d.records);
  const merge = M.importData(imported, {
    ...M.fresh(),
    records: [row({ reps: 7 })],
  });
  assert.equal(merge.conflicts, 1);
  assert.equal(merge.data.records[0].reps, 6);
});
test("malformed data, unexpected schemas and invalid set inputs are rejected", () => {
  for (const x of ["{", '{"__proto__":{}}'])
    assert.throws(() => M.safeParse(x));
  for (const x of [{}, { schema: 4 }, { v: 2, z: [] }])
    assert.throws(() => M.importData(M.fresh(), x));
  for (const x of [{ reps: null }, { rpe: 11 }, { rir: -1 }, { load: NaN }])
    assert.throws(() => M.validateSet(row(x)));
});
test("original keys survive migration; storage failure and stale tabs never clobber data", () => {
  const map = new Map([
    [
      "blueline.log.v2",
      JSON.stringify(legacy({ tt: { 4: { v: 40, s: 450 } } })),
    ],
    ["blueline3", '{"wk":7}'],
  ]);
  const storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
  const old = storage.getItem("blueline.log.v2");
  const d = M.readStore(storage);
  assert.equal(storage.getItem("blueline.log.v2"), old);
  assert.equal(storage.getItem("blueline3"), '{"wk":7}');
  assert.throws(() => M.persist(storage, d, "stale"));
  const fail = {
    ...storage,
    setItem: () => {
      throw Error("quota");
    },
  };
  assert.throws(() => M.persist(fail, d, storage.getItem(M.KEY)));
  assert.deepEqual(M.readStore(storage), d);
});
test("VDOT calculation preserved; ordinary runs never replace a reference", () => {
  assert.ok(Math.abs(C.vdot(1609.34, 420) - 41) < 2);
  let d = M.updateRecord(
    M.fresh(),
    row({ exerciseId: "long-easy-run", seconds: 3600, distance: 10 }),
  );
  assert.ok(Math.abs(C.activeReference(d, "z", program.paceDefaults).value - C.vdot(3218.69, 823)) < 1e-10);
  assert.equal(C.runReferences(d, "z").length, 0);
});
test("Zack's approved 13:43 two-mile result supersedes the old pace reference safely", () => {
  const expectedVdot = C.vdot(3218.69, 13 * 60 + 43);
  assert.ok(Math.abs(expectedVdot - 44.78627792342048) < 1e-10);
  assert.ok(Math.abs(program.paceDefaults.z.value - expectedVdot) < 1e-10);
  assert.equal(C.activeReference(M.fresh(), "z", program.paceDefaults).value, expectedVdot);
  assert.equal(program.paceDefaults.h.value, null);
  for (const w of [1, 2]) {
    const interval = s(w, "Tuesday", "z").exercises.find((e) => e.group === "WORK");
    assert.equal(interval.intensity, "T (current VDOT)");
  }
  const original = M.importData(M.fresh(), legacy({
    tt: { 4: { v: 47.2, s: 420 } },
  })).data;
  original.settings["pace:z"] = "legacy:z:tt:4";
  original.settings["pace:h"] = "untouched-hannah-reference";
  const before = M.canonical(original.records);
  const updated = M.adoptPaceRevision(original, program.paceDefaults);
  assert.equal(updated.settings["pace:z"], "program");
  assert.equal(updated.settings["pace:z:previousChoice"], "legacy:z:tt:4");
  assert.equal(updated.settings["pace:z:referenceRevision"], program.paceDefaults.z.referenceRevision);
  assert.equal(updated.settings["pace:h"], "untouched-hannah-reference");
  assert.equal(C.activeReference(updated, "z", program.paceDefaults).value, expectedVdot);
  assert.equal(M.canonical(updated.records), before);
  assert.equal(M.adoptPaceRevision(updated, program.paceDefaults), updated);
  const manual = M.clone(updated);
  manual.settings["pace:z"] = "legacy:z:tt:4";
  assert.equal(C.activeReference(manual, "z", program.paceDefaults).value, 47.2);
  assert.equal(M.adoptPaceRevision(manual, program.paceDefaults), manual);
  M.validateStore(updated);
});
test("VDOT training bands use Daniels-calibrated paces for Zack and Hannah", () => {
  const z = C.vdot(3218.69, 823);
  const h = C.vdot(1609.34, 614);
  assert.ok(Math.abs(z - 44.78627792342048) < 1e-10);
  assert.ok(Math.abs(h - 26.43419535242783) < 1e-10);
  const ze = C.paceBand(z, "E"), he = C.paceBand(h, "E");
  assert.ok(ze[0] >= 8 * 60 + 55 && ze[0] <= 9 * 60 + 5);
  assert.ok(ze[1] >= 9 * 60 + 25 && ze[1] <= 9 * 60 + 40);
  assert.ok(he[0] >= 13 * 60 && he[0] <= 13 * 60 + 30);
  assert.ok(he[1] >= 14 * 60 + 10 && he[1] <= 14 * 60 + 35);
  for (const V of [h, z, 35, 39, 45])
    for (const k of ["E", "M", "T", "I", "R"]) {
      const band = C.paceBand(V, k);
      assert.ok(band[0] > 0 && band[1] >= band[0], `${V}/${k}`);
      assert.ok(band[0] <= C.pace(V, k) && C.pace(V, k) <= band[1]);
    }
  const thirtyFive = C.paceBand(35, "E");
  // V.O2 published adjusted E at VDOT 35 = 10:36–11:38. These
  // deliberately practical coaching bands are within a few seconds.
  assert.ok(Math.abs(thirtyFive[0] - 636) < 5);
  assert.ok(Math.abs(thirtyFive[1] - 698) < 5);
  // Daniels' table gives approximately 7:25/mi for VDOT 45 threshold.
  assert.ok(Math.abs(C.pace(45, "T") - 445) < 5);
  assert.equal(C.paceBand(z, "2M")[0], C.paceBand(z, "2M")[1]);
  assert.equal(C.paceBand(h, "unknown"), null);
});
test("Hannah Week 1 test updates future pace reference unless explicitly pinned", () => {
  let d = M.fresh();
  assert.equal(C.activeReference(d, "h", program.paceDefaults).value, null);
  d = M.updateRecord(
    d,
    row({
      id: "set:w1-tuesday-h:test",
      athlete: "h",
      exerciseId: "2-mile-time-trial",
      variant: "2-mile-time-trial",
      seconds: 1200,
    }),
  );
  assert.equal(
    C.activeReference(d, "h", program.paceDefaults).value,
    C.vdot(3218.69, 1200),
  );
  const pinned = M.importData(
    d,
    legacy({}, { tt: { 4: { v: 30, s: 1300 } } }),
  ).data;
  pinned.settings["pace:h"] = "legacy:h:tt:4";
  assert.equal(C.activeReference(pinned, "h", program.paceDefaults).value, 30);
});
test("manual baseline estimates and unknown backoff reps never become completed sets", () => {
  const fixture = {
    schema: "flyfightwin_manual_baselines.v1",
    reference_date: "2026-01-01",
    zack: {
      performed: [
        {
          exercise: "barbell_z_press",
          top_set: { load_lb: 100, reps: 5 },
          backoffs: { load_lb: 90, reps_completed: null },
        },
      ],
      estimates_not_performed: [{ exercise: "push_press", load_lb: 150 }],
    },
    hannah: { unestablished: ["barbell_z_press"] },
  };
  const d = M.importData(M.fresh(), fixture).data;
  assert.equal(d.records.filter((r) => r.type === "set").length, 1);
  assert.equal(d.records.filter((r) => r.type === "session").length, 0);
  assert.equal(M.importData(d, fixture).added, 0);
});
test("RPE cap overrides calculated loading instead of forcing a percentage", () => {
  const d = M.updateRecord(M.fresh(), row({ rpe: 10 }));
  const e = s(1, "Monday").exercises.find((e) => e.top);
  assert.equal(C.loading(d, "z", e).range, null);
  assert.match(C.loading(d, "z", e).source, /exceeded/);
});
test("invalid v3 pace records are rejected before storage mutation", () => {
  const d = M.fresh();
  d.records = [
    {
      id: "bad",
      type: "legacy",
      athlete: "z",
      category: "tt",
      key: "1",
      value: null,
    },
  ];
  assert.throws(() => M.importData(M.fresh(), d));
});
test("consistent loading required before an accessory increase", () => {
  const e = s(1, "Monday").exercises.find((e) => e.group === "C1");
  const sets = [
    row({ reps: 10, rir: 2, load: 50 }),
    row({ reps: 10, rir: 2, load: 55 }),
    row({ reps: 10, rir: 2, load: 50 }),
  ];
  assert.match(C.doubleProgression(e, sets), /consistent/);
});
test("set logging alone counts as started without fabricating completion", () => {
  const ss = s(1, "Monday");
  const d = M.updateRecord(M.fresh(), row({ sessionId: ss.id }));
  assert.equal(M.sessionStatus(d, ss, "2000-01-01"), "started");
});
test("per-athlete v3 import does not change another athlete pace or increment", () => {
  const d = M.fresh();
  d.settings = { "pace:z": "pdf", "step:z:barbell-z-press": 5 };
  const next = M.importData(M.fresh(), d, ["h"]).data;
  assert.deepEqual(next.settings, {});
});
test("AA text contrast for every palette text and surface combination", () => {
  const luminance = (hex) => {
    const v = hex
      .match(/\w\w/g)
      .map((x) => parseInt(x, 16) / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
    return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
  };
  const ratio = (a, b) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) /
    (Math.min(luminance(a), luminance(b)) + 0.05);
  for (const ink of ["F8F3E6", "C4D2DA", "DFC780"])
    for (const bg of ["102B3D", "0C2232", "19364A", "24465A"])
      assert.ok(ratio(ink, bg) >= 4.5, `${ink}/${bg}`);
  assert.ok(ratio("0C2232", "DFC780") >= 4.5);
});
test("backoff records do not replace the top-set loading reference", () => {
  let d = M.updateRecord(
    M.fresh(),
    row({ slot: 0, updatedAt: "2026-01-01T10:00:00Z" }),
  );
  const e = s(1, "Monday").exercises.find((e) => e.top);
  const before = C.loading(d, "z", e);
  d = M.updateRecord(
    d,
    row({
      id: "backoff",
      slot: 1,
      load: 80,
      updatedAt: "2026-01-01T10:10:00Z",
    }),
  );
  assert.deepEqual(C.loading(d, "z", e), before);
});
test("changed running variant or shortened distance does not count as a two-mile test", () => {
  let d = M.updateRecord(
    M.fresh(),
    row({
      athlete: "h",
      exerciseId: "2-mile-time-trial",
      variant: "easy-run",
      seconds: 1200,
    }),
  );
  assert.equal(C.activeReference(d, "h", program.paceDefaults).value, null);
  d = M.updateRecord(
    d,
    row({
      athlete: "h",
      exerciseId: "2-mile-time-trial",
      variant: "2-mile-time-trial",
      seconds: 1200,
      distance: 1,
      distanceUnit: "mi",
    }),
  );
  assert.equal(C.activeReference(d, "h", program.paceDefaults).value, null);
});
