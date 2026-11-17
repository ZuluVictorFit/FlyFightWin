export function validateProgram(p) {
  const fail = (m) => {
    throw Error(`Program integrity: ${m}`);
  };
  if (
    !p ||
    typeof p.id !== "string" ||
    !p.id ||
    typeof p.blockId !== "string" ||
    !p.blockId ||
    !Number.isInteger(p.version) ||
    p.version < 1 ||
    !Number.isInteger(p.weeks) ||
    p.weeks < 1 ||
    p.weeks > 52
  )
    fail("invalid version or block");
  if (
    !Array.isArray(p.sessions) ||
    p.sessions.length !== p.weeks * 7 * 2 ||
    !Array.isArray(p.overview)
  )
    fail("wrong block size");
  for (const a of ["z", "h"]) {
    const policy = p.paceDefaults?.[a];
    if (
      !policy ||
      typeof policy.source !== "string" ||
      typeof policy.autoNewTests !== "boolean" ||
      !(
        policy.value === null ||
        (typeof policy.value === "number" &&
          Number.isFinite(policy.value) &&
          policy.value > 0)
      )
    )
      fail("invalid pace policy");
  }
  const keys = new Set();
  for (const s of p.sessions) {
    if (keys.has(s.id)) fail("duplicate session");
    keys.add(s.id);
    if (
      !["z", "h"].includes(s.athlete) ||
      s.week < 1 ||
      s.week > p.weeks ||
      !Number.isInteger(s.week) ||
      typeof s.title !== "string" ||
      !s.title ||
      !Array.isArray(s.exercises)
    )
      fail("invalid session");
    if (s.id !== `${p.blockId}:w${s.week}-${s.day.toLowerCase()}-${s.athlete}`)
      fail("session identity must belong to block");
    if (!s.exercises.length && !s.restDay) fail("empty active session");
    if (s.exercises.length && s.restDay) fail("rest day has exercises");
    const ids = new Set();
    for (const [i, e] of s.exercises.entries()) {
      if (
        ids.has(e.id) ||
        e.order !== i ||
        !e.id ||
        !e.exerciseId ||
        !e.group ||
        !e.name ||
        !e.prescription ||
        !e.intensity ||
        !e.rest ||
        !Number.isInteger(e.sets) ||
        e.sets < 1 ||
        !["strength", "run"].includes(e.kind)
      )
        fail(`${s.id}: bad exercise`);
      ids.add(e.id);
      if (
        e.sets !==
        e.setsText.split("+").reduce((n, x) => n + Number(x.trim()), 0)
      )
        fail("set count disagrees with source text");
      const top = e.prescription.match(/Top (\d+) \+ (\d+)x(\d+)/),
        back = e.intensity.match(/back (\d+)(?:-(\d+))?%/),
        rpe = e.intensity.match(/RPE (\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?/),
        rir = e.intensity.match(/(\d+)(?:-\d+)? RIR/),
        rep = e.prescription.match(/^(\d+)(?:-(\d+))?\s*(?:reps|\/|jumps)/);
      if (
        Boolean(top) !== Boolean(e.top) ||
        (top &&
          (e.top.reps !== +top[1] ||
            e.top.backSets !== +top[2] ||
            e.top.backReps !== +top[3] ||
            e.sets !== 1 + e.top.backSets ||
            !back ||
            e.top.backPercent[0] !== +back[1] ||
            e.top.backPercent[1] !== +(back[2] || back[1])))
      )
        fail("top/back-off metadata disagrees with prescription");
      if (
        (rpe ? +(rpe[2] || rpe[1]) : null) !== e.rpeCap ||
        (rir ? +rir[1] : null) !== e.rir
      )
        fail("effort metadata disagrees with prescription");
      if (
        JSON.stringify(rep ? [+rep[1], +(rep[2] || rep[1])] : null) !==
        JSON.stringify(e.repRange)
      )
        fail("rep range disagrees with prescription");
      if (
        /sled|carry/i.test(e.name) &&
        !e.device &&
        !e.prescription.includes("yd")
      )
        fail("sled/carry unit");
    }
  }
  for (const a of ["z", "h"])
    for (let w = 1; w <= p.weeks; w++)
      for (const day of [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ])
        if (!keys.has(`${p.blockId}:w${w}-${day}-${a}`)) fail("missing day");
  return p;
}

// A saved session freezes the prescription at first activity. Publishing a new
// master only changes unstarted sessions; actual records are never rewritten.
export function effectiveSession(store, planned) {
  const saved = store.records.find(
    (r) => r.type === "session" && r.sessionId === planned.id,
  );
  return saved?.prescriptionSnapshot
    ? structuredClone(saved.prescriptionSnapshot)
    : planned;
}
export function sessionRecord(store, program, session, status, date) {
  const old = store.records.find(
    (r) => r.type === "session" && r.sessionId === session.id,
  );
  return {
    ...old,
    id: `session:${session.id}`,
    type: "session",
    athlete: session.athlete,
    sessionId: session.id,
    status,
    date: old?.date || date,
    programVersion: old?.programVersion || program.id,
    blockId: old?.blockId || program.blockId,
    prescriptionSnapshot: old?.prescriptionSnapshot || structuredClone(session),
  };
}
