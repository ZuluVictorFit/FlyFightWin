import { validateProgram } from "./program.js";
const assert = (v, m) => {
  if (!v) throw Error(`Change request: ${m}`);
};
const identities = (s) =>
  JSON.stringify(s.exercises.map((e) => [e.id, e.exerciseId, e.name]));
/** Apply only an explicitly approved, version-bound request. Never touches logs. */
export function applyChangeRequest(current, request) {
  validateProgram(current);
  assert(
    request.schema === "flyfightwin.program-change.v1" &&
      request.approved === true &&
      typeof request.approvalReference === "string" &&
      request.approvalReference.trim(),
    "approval reference is required",
  );
  assert(request.baseProgramId === current.id, "stale base program");
  assert(
    typeof request.id === "string" &&
      request.id.trim() &&
      Array.isArray(request.changes) &&
      request.changes.length,
    "missing identity or changes",
  );
  assert(
    request.nextProgramId !== current.id &&
      typeof request.nextProgramId === "string" &&
      request.nextVersion === current.version + 1,
    "new revision must increment version",
  );
  let next = structuredClone(current);
  const touched = [];
  const replace = (index, replacement, c) => {
    const old = next.sessions[index];
    assert(
      old &&
        replacement.id === old.id &&
        replacement.athlete === old.athlete &&
        replacement.week === old.week &&
        replacement.day === old.day,
      "session identity cannot be changed",
    );
    assert(
      c.allowExerciseChange === true ||
        identities(old) === identities(replacement),
      "exercise identity/order change requires explicit allowExerciseChange",
    );
    next.sessions[index] = {
      ...structuredClone(replacement),
      approvalSource: request.id,
    };
    touched.push(old.id);
  };
  for (const c of request.changes) {
    assert(
      ["exercise", "session", "week", "block"].includes(c.scope),
      "unknown scope",
    );
    if (c.scope === "block") {
      assert(
        request.changes.length === 1 && c.allowExerciseChange === true,
        "whole-block replacement must be explicit and stand alone",
      );
      validateProgram(c.program);
      next = structuredClone(c.program);
      touched.push("entire block");
      continue;
    }
    assert(
      ["z", "h"].includes(c.athlete) && Number.isInteger(c.week),
      "athlete and week are required",
    );
    if (c.scope === "week") {
      assert(
        Array.isArray(c.sessions) && c.sessions.length === 7,
        "week replacement requires all seven days",
      );
      assert(new Set(c.sessions.map((s) => s.id)).size === 7, "duplicate day");
      for (const replacement of c.sessions) {
        assert(
          replacement.week === c.week && replacement.athlete === c.athlete,
          "replacement escaped athlete/week scope",
        );
        replace(
          next.sessions.findIndex((s) => s.id === replacement.id),
          replacement,
          c,
        );
      }
      continue;
    }
    const i = next.sessions.findIndex(
      (s) => s.athlete === c.athlete && s.week === c.week && s.day === c.day,
    );
    assert(i >= 0, "session not found");
    if (c.scope === "session") {
      replace(i, c.session, c);
      continue;
    }
    const s = structuredClone(next.sessions[i]),
      e = s.exercises.find((e) => e.id === c.exerciseId);
    assert(
      e && c.patch && typeof c.patch === "object" && !Array.isArray(c.patch),
      "exercise or patch missing",
    );
    assert(
      !Object.hasOwn(c.patch, "id") && !Object.hasOwn(c.patch, "order"),
      "stable exercise slot identity/order cannot be patched",
    );
    const allowed = new Set(Object.keys(e));
    for (const k of Object.keys(c.patch))
      assert(allowed.has(k), "unknown exercise field");
    Object.assign(e, structuredClone(c.patch));
    replace(i, s, c);
  }
  next.id = request.nextProgramId;
  next.version = request.nextVersion;
  next.changeHistory = [
    ...(current.changeHistory || []),
    {
      id: request.id,
      approvalReference: request.approvalReference,
      baseProgramId: current.id,
      programId: next.id,
      targets: [...new Set(touched)],
    },
  ];
  validateProgram(next);
  return next;
}
