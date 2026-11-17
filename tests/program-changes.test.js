import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { applyChangeRequest } from "../src/program-changes.js";
import {
  validateProgram,
  effectiveSession,
  sessionRecord,
} from "../src/program.js";
import * as M from "../src/model.js";
import * as C from "../src/calculations.js";
const p = JSON.parse(
  fs.readFileSync(new URL("../data/program.json", import.meta.url)),
);
const session = (program, a = "h", w = 1, d = "Monday") =>
  program.sessions.find((s) => s.week === w && s.day === d && s.athlete === a);
const request = (changes) => ({
  schema: "flyfightwin.program-change.v1",
  id: "synthetic-change",
  approved: true,
  approvalReference: "Synthetic test only — not an approved training change",
  baseProgramId: p.id,
  nextProgramId: "athletic-strength-8-v2",
  nextVersion: 2,
  changes,
});
const exerciseChange = () => ({
  scope: "exercise",
  athlete: "h",
  week: 1,
  day: "Monday",
  exerciseId: session(p).exercises.find((e) => e.group === "C1").id,
  patch: { prescription: "6-8 reps", repRange: [6, 8] },
});
test("targeted prescription change affects one athlete and one exercise, without mutating input", () => {
  const before = M.canonical(p),
    next = applyChangeRequest(p, request([exerciseChange()]));
  assert.equal(M.canonical(p), before);
  assert.deepEqual(
    next.sessions.filter((s) => s.athlete === "z"),
    p.sessions.filter((s) => s.athlete === "z"),
  );
  const changed = next.sessions.filter(
    (s, i) => M.canonical(s) !== M.canonical(p.sessions[i]),
  );
  assert.equal(changed.length, 1);
  assert.equal(changed[0].athlete, "h");
  assert.equal(next.version, 2);
});
test("completed sessions and recorded performance stay frozen through a program update", () => {
  const s = session(p),
    e = s.exercises.find((e) => e.group === "C1");
  let d = M.updateRecord(
    M.fresh(),
    sessionRecord(M.fresh(), p, s, "completed", "2026-01-01"),
  );
  d = M.updateRecord(d, {
    id: "synthetic-set",
    type: "set",
    athlete: "h",
    sessionId: s.id,
    exerciseId: e.exerciseId,
    variant: e.exerciseId,
    status: "done",
    load: 20,
    reps: 10,
    rir: 2,
    unit: e.loadUnit,
    date: "2026-01-01",
    prescriptionSnapshot: e,
    programVersion: p.id,
  });
  const before = M.canonical(d),
    next = applyChangeRequest(p, request([exerciseChange()]));
  assert.deepEqual(effectiveSession(d, session(next)), s);
  assert.equal(M.canonical(d), before);
  assert.notDeepEqual(effectiveSession(M.fresh(), session(next)), s);
  assert.equal(
    sessionRecord(d, next, s, "started", "2026-02-01").programVersion,
    p.id,
  );
});
test("new prescription recalculates accessory progression but never changes actual reps", () => {
  const e = session(p).exercises.find((e) => e.group === "C1"),
    sets = Array.from({ length: 3 }, () => ({
      status: "done",
      load: 20,
      unit: e.loadUnit,
      reps: 8,
      rir: 2,
    }));
  const before = M.canonical(sets),
    next = applyChangeRequest(p, request([exerciseChange()])),
    updated = session(next).exercises.find((x) => x.id === e.id);
  assert.match(C.doubleProgression(e, sets), /build/);
  assert.match(C.doubleProgression(updated, sets), /Increase/);
  assert.equal(M.canonical(sets), before);
});
test("changing top reps recalculates the initial band while preserving logged evidence", () => {
  const s = session(p),
    e = s.exercises.find((e) => e.top),
    change = {
      scope: "exercise",
      athlete: "h",
      week: 1,
      day: "Monday",
      exerciseId: e.id,
      patch: { prescription: "Top 3 + 3x6", top: { ...e.top, reps: 3 } },
    };
  const next = applyChangeRequest(p, request([change]));
  assert.deepEqual(C.initialBand(e), [77, 83]);
  assert.deepEqual(
    C.initialBand(session(next).exercises.find((x) => x.id === e.id)),
    [80, 87],
  );
});
test("reject missing prescriptions, stale revisions, unapproved or implicit exercise substitutions", () => {
  for (const req of [
    { ...request([exerciseChange()]), approved: false },
    { ...request([exerciseChange()]), baseProgramId: "old" },
    request([{ ...exerciseChange(), patch: { name: "Different exercise" } }]),
    request([{ ...exerciseChange(), patch: { prescription: "" } }]),
    request([{ ...exerciseChange(), patch: { prescription: "6-8 reps" } }]),
  ])
    assert.throws(() => applyChangeRequest(p, req));
});
test("session and week replacements stay within explicit athlete scope", () => {
  const s = structuredClone(session(p));
  s.note = "Synthetic session annotation";
  const next = applyChangeRequest(
    p,
    request([
      { scope: "session", athlete: "h", week: 1, day: "Monday", session: s },
    ]),
  );
  assert.equal(session(next).note, s.note);
  const week = p.sessions
    .filter((s) => s.week === 2 && s.athlete === "h")
    .map((s) => ({ ...s, note: "Synthetic week annotation" }));
  const revised = applyChangeRequest(
    p,
    request([{ scope: "week", athlete: "h", week: 2, sessions: week }]),
  );
  assert.deepEqual(
    revised.sessions.filter((s) => s.athlete === "z"),
    p.sessions.filter((s) => s.athlete === "z"),
  );
  assert.throws(() =>
    applyChangeRequest(
      p,
      request([
        { scope: "week", athlete: "h", week: 2, sessions: week.slice(1) },
      ]),
    ),
  );
});
test("whole new block has independent session identities and validates without UI changes", () => {
  const nextBlock = structuredClone(p);
  nextBlock.blockId = "synthetic-next-block";
  nextBlock.id = "synthetic-next-block-v2";
  nextBlock.version = 2;
  nextBlock.sessions = nextBlock.sessions.map((s) => ({
    ...s,
    id: s.id.replace(p.blockId, nextBlock.blockId),
  }));
  const req = request([
    { scope: "block", program: nextBlock, allowExerciseChange: true },
  ]);
  req.nextProgramId = nextBlock.id;
  const next = applyChangeRequest(p, req);
  validateProgram(next);
  assert.ok(
    next.sessions.every((s) => !p.sessions.some((old) => old.id === s.id)),
  );
});
test("validation detects removal, reordering and contradictory effort metadata", () => {
  for (const mutate of [
    (q) => q.sessions.pop(),
    (q) => (q.sessions[0].exercises[0].order = 4),
    (q) => (q.sessions[0].exercises.find((e) => e.top).rpeCap = 10),
  ]) {
    const q = structuredClone(p);
    mutate(q);
    assert.throws(() => validateProgram(q));
  }
});
