import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as M from "../src/model.js";
import * as D from "../src/drafts.js";
import * as C from "../src/calculations.js";
import { effectiveSession } from "../src/program.js";
const program = JSON.parse(
  fs.readFileSync(new URL("../data/program.json", import.meta.url)),
);
const date = "2026-01-05";
const s = program.sessions.find(
  (s) => s.week === 1 && s.day === "Monday" && s.athlete === "z",
);
const e = {
  ...s.exercises.find((e) => e.exerciseId === "incline-dumbbell-bench"),
  repRange: [8, 8],
  prescription: "8 reps",
};
const synthetic = { ...s, exercises: [e] };
const edit = (d, index, key, value, exercise = e, session = synthetic) =>
  D.editDraft(
    d,
    program,
    session,
    exercise,
    M.setSlots(exercise)[index],
    key,
    value,
    date,
  );
const rows = (d, exercise = e, session = synthetic) =>
  M.setSlots(exercise).map((slot) => D.row(d, session, exercise, slot, date));
const finish = (d) => D.finishWorkout(d, program, synthetic, date, null);

test("exact reps and required checks prefill without invented effort or history", () => {
  const d = M.fresh();
  assert.deepEqual(
    rows(d).map((r) => [r.reps, r.checked, r.rpe, r.rir, r.load]),
    Array(3).fill(["8", true, "", "", ""]),
  );
  assert.equal(d.records.length, 0);
  assert.ok(rows(d, { ...e, optional: true }).every((r) => !r.checked));
  // Rep ranges default to the low end without creating performed records.
  assert.ok(
    rows(d, { ...e, repRange: [8, 10], prescription: "8-10 reps" }).every(
      (r) => r.reps === "8" && r.checked,
    ),
  );
  const actualBench = s.exercises.find((x) => x.exerciseId === "incline-dumbbell-bench");
  assert.deepEqual(
    rows(d, actualBench, s).map((r) => [r.reps, r.load, r.rir]),
    [["8", "", ""], ["8", "", ""], ["8", "", ""]],
  );
  assert.equal(d.records.length, 0);
  const top = s.exercises.find((e) => e.top);
  assert.deepEqual(
    rows(d, top, s).map((r) => r.reps),
    [
      String(top.top.reps),
      ...Array(top.top.backSets).fill(String(top.top.backReps)),
    ],
  );
});

test("forward-only independent fields implement all incline bench examples", () => {
  const original = M.fresh();
  const first = edit(original, 0, "load", "80");
  assert.deepEqual(
    rows(first).map((r) => [r.load, r.reps]),
    [
      ["80", "8"],
      ["80", "8"],
      ["80", "8"],
    ],
  );
  const load = edit(first, 1, "load", "70");
  assert.deepEqual(
    rows(load).map((r) => [r.load, r.reps]),
    [
      ["80", "8"],
      ["70", "8"],
      ["70", "8"],
    ],
  );
  const reps = edit(first, 1, "reps", "6");
  assert.deepEqual(
    rows(reps).map((r) => [r.load, r.reps]),
    [
      ["80", "8"],
      ["80", "6"],
      ["80", "6"],
    ],
  );
  const both = edit(load, 1, "reps", "6");
  assert.deepEqual(
    rows(both).map((r) => [r.load, r.reps]),
    [
      ["80", "8"],
      ["70", "6"],
      ["70", "6"],
    ],
  );
  assert.deepEqual(
    rows(edit(both, 2, "rir", "1")).map((r) => r.rir),
    ["", "", "1"],
  );
  assert.deepEqual(
    rows(edit(both, 0, "load", "85")).map((r) => r.load),
    ["85", "85", "85"],
  );
  assert.equal(original.drafts, undefined);
  assert.deepEqual(both.records, []);
});

test("effort and half-point RPE intervals propagate without touching load or reps", () => {
  let d = edit(M.fresh(), 0, "load", "80");
  d = edit(d, 1, "rpe", "7.5");
  d = edit(d, 1, "rir", "2");
  assert.deepEqual(
    rows(d).map((r) => [r.rpe, r.rir, r.load, r.reps]),
    [
      ["", "", "80", "8"],
      ["7.5", "2", "80", "8"],
      ["7.5", "2", "80", "8"],
    ],
  );
  d = edit(d, 1, "rpeLow", "7");
  d = edit(d, 1, "rpeHigh", "8");
  assert.deepEqual(
    rows(d).map((r) => [r.rpe, r.rpeLow, r.rpeHigh]),
    [
      ["", "", ""],
      ["", "7", "8"],
      ["", "7", "8"],
    ],
  );
  assert.deepEqual(
    finish(d)
      .records.filter((r) => r.type === "set")
      .map((r) => r.rpeRange),
    [undefined, [7, 8], [7, 8]],
  );
});

test("top/back-off groups and unilateral sides are strict propagation boundaries", () => {
  const top = s.exercises.find((e) => e.top);
  let d = edit(M.fresh(), 0, "load", "125", top, s);
  d = edit(d, 0, "rpe", "7.5", top, s);
  assert.deepEqual(
    rows(d, top, s).map((r) => r.load),
    ["125", "", "", ""],
  );
  assert.deepEqual(
    rows(d, top, s).map((r) => r.rpe),
    ["7.5", "", "", ""],
  );
  d = edit(d, 1, "load", "110", top, s);
  assert.deepEqual(
    rows(d, top, s).map((r) => r.load),
    ["125", "110", "110", "110"],
  );
  assert.deepEqual(C.backoff(125, top, 5), [110, 115]);
  const one = { ...e, unilateral: true };
  d = edit(M.fresh(), 0, "load", "80", one);
  d = edit(d, 3, "reps", "6", one);
  assert.deepEqual(
    rows(d, one).map((r) => [r.load, r.reps]),
    [
      ["80", "8"],
      ["", "8"],
      ["80", "8"],
      ["", "6"],
      ["80", "8"],
      ["", "6"],
    ],
  );
});

test("propagation never overwrites finalized rows; explicit corrections retain revisions", () => {
  let d = finish(edit(M.fresh(), 0, "load", "80"));
  const previous = M.clone(d.records);
  d = edit(d, 1, "load", "70");
  assert.deepEqual(
    rows(d).map((r) => r.load),
    ["80", "70", "80"],
  );
  assert.deepEqual(d.records, previous);
  d = finish(d);
  assert.deepEqual(
    d.records.filter((r) => r.type === "set").map((r) => r.load),
    [80, 70, 80],
  );
  assert.ok(
    d.revisions.some((v) => v.record.load === 80 && v.record.slot === 1),
  );
  assert.deepEqual(
    d.records.find((r) => r.type === "set" && r.slot === 0),
    previous.find((r) => r.type === "set" && r.slot === 0),
  );
});

test("propagation skips a finalized middle set and continues to later unfinalized sets", () => {
  const complete = finish(edit(M.fresh(), 0, "load", "80"));
  const d = M.fresh();
  d.records = complete.records.filter((r) => r.type === "set" && r.slot === 1);
  const updated = edit(d, 0, "load", "70");
  assert.deepEqual(
    rows(updated).map((r) => r.load),
    ["70", "80", "70"],
  );
  assert.deepEqual(updated.records, d.records);
});

test("drafts and Undo survive JSON storage, backups, athlete-scoped merge and conflicts", () => {
  let d = edit(M.fresh(), 0, "load", "80");
  d = edit(d, 1, "load", "70");
  const other = {
    ...synthetic,
    id: synthetic.id.replace(/-z$/, "-h"),
    athlete: "h",
  };
  d = edit(d, 0, "load", "30", e, other);
  const restored = M.importData(M.fresh(), JSON.parse(JSON.stringify(d))).data;
  assert.deepEqual(restored.drafts, d.drafts);
  assert.deepEqual(
    rows(D.undoDraft(restored, synthetic)).map((r) => r.load),
    ["80", "80", "80"],
  );
  assert.equal(
    D.undoDraft(restored, synthetic).drafts[other.id].sets[
      D.setId(other, e, M.setSlots(e)[0])
    ].load,
    "30",
  );
  const scoped = M.importData(M.fresh(), d, ["z"]).data;
  assert.deepEqual(Object.keys(scoped.drafts), [synthetic.id]);
  assert.equal(M.importData(restored, d).conflicts, 0);
  const incoming = edit(d, 0, "load", "90");
  const conflict = M.importData(restored, incoming);
  assert.equal(conflict.conflicts, 1);
  assert.deepEqual(
    rows(conflict.data).map((r) => r.load),
    ["80", "70", "70"],
  );
  assert.deepEqual(
    rows(M.resolveConflict(conflict.data, 0, true)).map((r) => r.load),
    ["90", "90", "90"],
  );
  assert.equal(M.importData(M.fresh(), M.fresh()).data.drafts, undefined);
});

test("Finish is atomic; unchecked required sets are skipped and optional work is not invented", () => {
  let d = edit(M.fresh(), 1, "checked", false);
  const optional = { ...e, id: "optional", optional: true };
  const session = { ...synthetic, exercises: [e, optional] };
  let done = D.finishWorkout(d, program, session, date, null);
  assert.deepEqual(
    done.records.filter((r) => r.type === "set").map((r) => r.status),
    ["done", "skipped", "done"],
  );
  assert.equal(done.drafts[synthetic.id], undefined);
  assert.equal(
    done.records.find((r) => r.type === "session").status,
    "completed",
  );
  d = edit(d, 2, "reps", "");
  const before = M.canonical(d);
  assert.throws(() => finish(d), /Record reps, time or distance/);
  assert.equal(M.canonical(d), before);
  d = edit(d, 2, "reps", "8");
  d = edit(d, 2, "rpe", "11");
  assert.throws(() => finish(d), /RPE must/);
});

test("draft snapshot freezes programming and does not affect progression or another athlete", () => {
  const d = edit(M.fresh(), 0, "load", "80");
  const changed = {
    ...synthetic,
    exercises: [{ ...e, prescription: "6 reps", repRange: [6, 6] }],
  };
  assert.deepEqual(effectiveSession(d, changed), synthetic);
  assert.deepEqual(C.matchedHistory(d, "z", e.exerciseId, e.loadUnit), []);
  assert.deepEqual(C.matchedHistory(d, "h", e.exerciseId, e.loadUnit), []);
  assert.equal(M.sessionStatus(d, synthetic), "draft");
  const done = D.finishWorkout(
    d,
    { ...program, id: "new-revision" },
    effectiveSession(d, changed),
    date,
    null,
  );
  assert.equal(
    done.records.find((r) => r.type === "session").programVersion,
    program.id,
  );
  assert.deepEqual(
    done.records.find((r) => r.type === "session").prescriptionSnapshot,
    synthetic,
  );
});

test("concurrent imported history cannot be silently overwritten by an older draft", () => {
  const d = edit(M.fresh(), 0, "load", "80");
  const incoming = finish(edit(M.fresh(), 0, "load", "70"));
  const merged = M.importData(d, incoming).data;
  assert.throws(() => finish(merged), /history changed after this draft/);
  assert.deepEqual(merged.records, incoming.records);
});

test("all prescribed sessions can finalize checked inputs without changing program data", () => {
  const original = M.canonical(program);
  let d = M.fresh();
  for (const session of program.sessions.filter((s) => !s.restDay)) {
    for (const ex of session.exercises.filter(
      (e) => !e.warmup && !e.optional,
    )) {
      for (const slot of M.setSlots(ex)) {
        const field =
          ex.kind === "run"
            ? "seconds"
            : ex.prescription.includes("yd")
              ? "distance"
              : "reps";
        if (!D.row(d, session, ex, slot, date)[field])
          d = D.editDraft(d, program, session, ex, slot, field, "5", date);
      }
    }
    d = D.finishWorkout(d, program, session, date, {
      value: null,
      source: "synthetic",
    });
  }
  assert.equal(
    d.records.filter((r) => r.type === "session" && r.status === "completed")
      .length,
    96,
  );
  assert.equal(M.canonical(program), original);
});

test("unchecked work does not finalize incomplete effort or assumed reps", () => {
  let d = edit(M.fresh(), 1, "rpeLow", "7");
  d = edit(d, 1, "checked", false);
  d = edit(d, 2, "checked", false);
  const done = finish(d),
    skipped = done.records.find((r) => r.type === "set" && r.slot === 1);
  assert.equal(skipped.status, "skipped");
  assert.equal(skipped.load, null);
  assert.equal(skipped.reps, null);
  assert.equal(skipped.rpe, null);
  assert.equal(skipped.rpeRange, undefined);
});

test("failed storage writes retain both drafts and finalized history", () => {
  const data = edit(M.fresh(), 0, "load", "80"),
    raw = JSON.stringify(data);
  const storage = {
    getItem: () => raw,
    setItem: () => {
      throw Error("Quota exceeded");
    },
  };
  assert.throws(() => M.persist(storage, finish(data), raw), /Quota exceeded/);
  assert.equal(storage.getItem(M.KEY), raw);
  assert.throws(
    () =>
      M.persist(
        { getItem: () => "{changed}", setItem: () => assert.fail() },
        data,
        raw,
      ),
    /Another tab/,
  );
  assert.equal(D.undoDraft(data, synthetic).drafts[synthetic.id], undefined);
});
