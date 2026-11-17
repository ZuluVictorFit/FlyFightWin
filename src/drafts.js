import * as M from "./model.js";
import { sessionRecord } from "./program.js";

export const setId = (s, e, slot) => `set:${s.id}:${e.id}:${slot.key}`;
const numeric = ["load", "reps", "seconds", "distance", "rpe", "rir"];
const fields = [
  ...numeric,
  "rpeLow",
  "rpeHigh",
  "date",
  "unit",
  "variant",
  "deviceMode",
  "notes",
  "checked",
];
const propagated = new Set(["load", "reps", "rpe", "rir", "rpeLow", "rpeHigh"]);
const group = (e, slot) =>
  `${slot.side}:${e.top ? (slot.index === 0 ? "top" : "back") : "work"}`;

export function prescribedReps(e, slot) {
  if (e.top) return slot.index === 0 ? e.top.reps : e.top.backReps;
  // A rep range defaults to its prescribed minimum; this is a draft assumption,
  // not a completed result, and each set remains individually editable.
  if (Array.isArray(e.repRange) && e.repRange.length === 2 &&
      Number.isInteger(e.repRange[0]) && e.repRange[0] > 0)
    return e.repRange[0];
  const sequences = e.prescription.match(/^(\d+) out-and-back sequences$/);
  return sequences ? Number(sequences[1]) : null;
}

export function row(store, s, e, slot, date) {
  const id = setId(s, e, slot),
    saved = store.records.find((r) => r.id === id);
  const draft = store.drafts?.[s.id];
  if (draft?.sets[id]) return M.clone(draft.sets[id]);
  const value = {
    checked: saved ? saved.status === "done" : !e.optional,
    date: saved?.date || draft?.date || date,
    unit: saved?.unit || (e.kind === "run" ? "running" : e.loadUnit),
    variant: saved?.variant || e.exerciseId,
    notes: saved?.notes || "",
    deviceMode: saved?.deviceMode || "",
    rpeLow: saved?.rpeRange?.[0]?.toString() || "",
    rpeHigh: saved?.rpeRange?.[1]?.toString() || "",
    base: saved ? M.clone(saved) : null,
  };
  for (const k of numeric) value[k] = saved ? String(saved[k] ?? "") : "";
  if (!saved) value.reps = String(prescribedReps(e, slot) ?? "");
  return value;
}

export function startDraft(store, program, s, date) {
  if (store.drafts?.[s.id]) return M.clone(store);
  const next = M.clone(store);
  next.drafts ||= {};
  const saved = store.records.find(
    (r) => r.type === "session" && r.sessionId === s.id,
  );
  next.drafts[s.id] = {
    athlete: s.athlete,
    sessionId: s.id,
    date,
    programVersion: saved?.programVersion || program.id,
    prescriptionSnapshot: M.clone(s),
    sets: {},
    undo: [],
  };
  return next;
}

export function editDraft(store, program, s, e, slot, field, value, date) {
  if (!fields.includes(field)) throw Error("Unknown draft field");
  if (
    field === "checked" ? typeof value !== "boolean" : typeof value !== "string"
  )
    throw Error("Invalid draft value");
  const next = startDraft(store, program, s, date),
    draft = next.drafts[s.id];
  const before = M.clone(draft.sets);
  for (const target of M.setSlots(e)) {
    const id = setId(s, e, target),
      source = target.key === slot.key;
    if (
      !source &&
      (!propagated.has(field) ||
        target.index < slot.index ||
        group(e, target) !== group(e, slot))
    )
      continue;
    // A direct correction is a draft until Finish. Propagation never touches a finalized row.
    if (!source && store.records.some((r) => r.id === id)) continue;
    const v = row(next, s, e, target, date);
    if (!source) {
      const origin = row(next, s, e, slot, date);
      if (v.variant !== origin.variant || v.unit !== origin.unit) continue;
    }
    v[field] = value;
    // Single RPE and an RPE interval are alternative representations of effort.
    if (field === "rpe" && value !== "") v.rpeLow = v.rpeHigh = "";
    if (["rpeLow", "rpeHigh"].includes(field) && value !== "") v.rpe = "";
    draft.sets[id] = v;
  }
  if (M.canonical(before) !== M.canonical(draft.sets))
    draft.undo = [...draft.undo.slice(-29), before];
  return next;
}

export function undoDraft(store, s) {
  const next = M.clone(store),
    draft = next.drafts?.[s.id];
  if (draft?.undo.length) draft.sets = draft.undo.pop();
  if (draft && !draft.undo.length && !Object.keys(draft.sets).length)
    delete next.drafts[s.id];
  return next;
}

// Build the entire transaction before persisting anything. Invalid checked rows
// leave both drafts and finalized history intact.
export function finishWorkout(store, program, s, date, paceReference) {
  let next = M.clone(store);
  const draft = store.drafts?.[s.id];
  for (const e of s.exercises.filter((e) => !e.warmup)) {
    for (const slot of M.setSlots(e)) {
      const id = setId(s, e, slot),
        old = store.records.find((r) => r.id === id);
      const edited = draft?.sets[id],
        v = row(store, s, e, slot, date);
      if (old && !edited) continue;
      if (edited && M.canonical(edited.base) !== M.canonical(old || null))
        throw Error(
          `${e.name}: history changed after this draft. Export a backup and resolve the draft before finishing.`,
        );
      if (e.optional && !v.checked && !old) continue;
      const r = {
        id,
        type: "set",
        athlete: s.athlete,
        sessionId: s.id,
        exerciseId: e.exerciseId,
        slot: slot.index,
        side: slot.side,
        variant: v.variant.trim() || (!v.checked ? e.exerciseId : ""),
        date: v.date || (!v.checked ? date : ""),
        unit: v.unit,
        distanceUnit:
          e.kind === "run" ? (/\bm\b/.test(e.prescription) ? "m" : "mi") : "yd",
        deviceMode: v.deviceMode || null,
        notes:
          v.notes ||
          (v.checked ? "" : "Not completed; unchecked at Finish Workout."),
        status: v.checked ? "done" : "skipped",
        updatedAt: new Date().toISOString(),
        prescriptionSnapshot: old?.prescriptionSnapshot || M.clone(e),
        paceReference:
          e.kind === "run"
            ? M.clone(old?.paceReference || paceReference)
            : null,
        programVersion:
          old?.programVersion ||
          draft?.programVersion ||
          store.records.find(
            (r) => r.type === "session" && r.sessionId === s.id,
          )?.programVersion ||
          program.id,
        provenance: v.checked
          ? "performed; entered in app"
          : "skipped; unchecked at Finish Workout",
      };
      for (const k of numeric)
        r[k] = !v.checked || v[k] === "" ? null : Number(v[k]);
      try {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
          isNaN(Date.parse(r.date)) ||
          !r.variant
        )
          throw Error("Date and variant are required.");
        if (v.checked && (v.rpeLow || v.rpeHigh)) {
          if (!v.rpeLow || !v.rpeHigh)
            throw Error("Enter both actual RPE range endpoints.");
          r.rpeRange = [Number(v.rpeLow), Number(v.rpeHigh)];
        }
        if (r.reps != null && !Number.isInteger(r.reps))
          throw Error("Reps must be a whole number.");
        next = M.updateRecord(next, r);
      } catch (err) {
        throw Error(
          `${e.name}, set ${slot.index + 1}${slot.side}: ${err.message}`,
        );
      }
    }
  }
  if (
    !next.records.some(
      (r) => r.type === "set" && r.sessionId === s.id && r.status === "done",
    )
  )
    throw Error("Check at least one performed set before finishing.");
  next = M.updateRecord(
    next,
    sessionRecord(store, program, s, "completed", date),
  );
  if (next.drafts) delete next.drafts[s.id];
  return M.validateStore(next);
}
