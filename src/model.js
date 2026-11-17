export const KEY = "flyfightwin.log.v3";
export const clone = (x) => structuredClone(x);
export const canonical = (x) =>
  JSON.stringify(x, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
const obj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const assert = (v, m) => {
  if (!v) throw Error(m);
};
export const fresh = () => ({
  schema: 3,
  migrationVersion: 1,
  records: [],
  imports: [],
  conflicts: [],
  settings: {},
  revisions: [],
});
export function safeParse(text) {
  assert(text.length < 12000000, "File exceeds 12 MB.");
  return JSON.parse(text, (k, v) => {
    assert(
      !["__proto__", "prototype", "constructor"].includes(k),
      "Unsafe object key",
    );
    return v;
  });
}
export function validateStore(d) {
  assert(
    obj(d) && d.schema === 3 && d.migrationVersion === 1,
    "Unsupported backup version",
  );
  for (const k of ["records", "imports", "conflicts", "revisions"])
    assert(Array.isArray(d[k]), `Missing ${k}`);
  assert(obj(d.settings), "Invalid settings");
  for (const [k, v] of Object.entries(d.settings)) {
    if (k.startsWith("step:"))
      assert(
        typeof v === "number" && v >= 0.25 && v <= 100,
        "Invalid load increment",
      );
    if (k.startsWith("pace:"))
      assert(typeof v === "string", "Invalid pace selection");
    if (k === "startDate")
      assert(
        typeof v === "string" &&
          (!v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)))),
        "Invalid start date",
      );
  }
  const ids = new Set();
  for (const r of d.records) {
    assert(
      obj(r) &&
        typeof r.id === "string" &&
        ["z", "h", "both"].includes(r.athlete) &&
        typeof r.type === "string",
      "Invalid record",
    );
    assert(!ids.has(r.id), "Duplicate record ID");
    ids.add(r.id);
    if (r.type === "set") validateSet(r);
    if (r.type === "legacy") {
      assert(
        typeof r.category === "string" &&
          typeof r.key === "string" &&
          "value" in r,
        "Invalid legacy record",
      );
      if (r.category === "tt")
        assert(
          obj(r.value) && Number.isFinite(r.value.v),
          "Invalid legacy pace record",
        );
    }
    if (r.type === "baseline")
      assert(obj(r.value) && typeof r.date === "string", "Invalid baseline");
    if (r.type === "session")
      assert(
        ["started", "completed"].includes(r.status) &&
          typeof r.sessionId === "string",
        "Invalid session",
      );
    assert(
      ["set", "legacy", "baseline", "session"].includes(r.type),
      "Unknown record type",
    );
  }
  for (const c of d.conflicts)
    assert(
      obj(c) &&
        typeof c.id === "string" &&
        obj(c.incoming) &&
        typeof c.incoming.id === "string",
      "Invalid conflict",
    );
  return d;
}
export function validateSet(r) {
  assert(["done", "skipped"].includes(r.status), "Set status required");
  for (const k of ["load", "reps", "seconds", "distance", "rpe", "rir"])
    if (r[k] != null) {
      assert(typeof r[k] === "number" && Number.isFinite(r[k]), `Invalid ${k}`);
      assert(
        r[k] >= 0 || (k === "load" && r.unit === "lb added / assistance"),
        `${k} cannot be negative`,
      );
    }
  assert(r.rpe == null || (r.rpe >= 1 && r.rpe <= 10), "RPE must be 1–10");
  assert(r.rir == null || r.rir <= 10, "RIR must be 0–10");
  assert(
    r.status === "skipped" || r.reps > 0 || r.seconds > 0 || r.distance > 0,
    "Record reps, time or distance before saving",
  );
  assert(
    typeof r.exerciseId === "string" &&
      typeof r.variant === "string" &&
      typeof r.sessionId === "string",
    "Missing set identity",
  );
}
function legacyRecords(input) {
  assert(
    input.v === 2 && obj(input.z) && obj(input.h),
    "Expected v2 backup with both athlete objects",
  );
  const records = [];
  for (const a of ["z", "h"])
    for (const [category, data] of Object.entries(input[a])) {
      if (["tt", "mx", "ro", "pt", "rm3"].includes(category))
        assert(obj(data), "Invalid legacy category");
      for (const [key, value] of Object.entries(
        obj(data) || Array.isArray(data) ? data : { unknown: data },
      ))
        records.push({
          id: `legacy:${a}:${category}:${key}`,
          type: "legacy",
          athlete: a,
          category,
          key,
          value,
          provenance: "legacy v2; date unknown",
        });
    }
  return records;
}
const aliases = {
  barbell_z_press: "barbell-z-press",
  incline_dumbbell_bench: "incline-dumbbell-bench",
  pendlay_row: "pendlay-row",
  single_arm_dumbbell_row: "single-arm-dumbbell-row",
};
function baselineRecords(d) {
  assert(
    d.schema === "flyfightwin_manual_baselines.v1" &&
      obj(d.zack) &&
      obj(d.hannah) &&
      typeof d.reference_date === "string",
    "Invalid baseline package",
  );
  const records = [];
  for (const [a, name] of [
    ["z", "zack"],
    ["h", "hannah"],
  ]) {
    records.push({
      id: `baseline:${a}:${d.reference_date}`,
      type: "baseline",
      athlete: a,
      date: d.reference_date,
      value: d[name],
      provenance: d.provenance,
    });
    for (const [i, item] of (d[name].performed || []).entries()) {
      const sets =
        item.sets || [item.top_set || item.sample_working_set].filter(Boolean);
      for (const [j, s] of sets.entries())
        if (s.reps > 0 && (s.load_lb > 0 || s.each_dumbbell_lb > 0))
          records.push({
            id: `baseline-set:${a}:${d.reference_date}:${i}:${j}`,
            type: "set",
            athlete: a,
            exerciseId:
              aliases[item.exercise] || item.exercise.replaceAll("_", "-"),
            variant:
              aliases[item.exercise] || item.exercise.replaceAll("_", "-"),
            sessionId: "historical-baseline",
            date: item.date || d.reference_date,
            status: "done",
            load: s.load_lb ?? s.each_dumbbell_lb,
            reps: s.reps,
            rpe: s.rpe ?? s.rpe_approx ?? null,
            rir: item.rir ?? null,
            unit: s.each_dumbbell_lb ? "lb per hand" : "lb total",
            provenance: "performed; user-reported",
            notes: item.note,
          });
    }
  }
  return records;
}
export function importData(current, input, athletes = ["z", "h"]) {
  validateStore(current);
  assert(obj(input), "Expected an object");
  let incoming, source;
  if (input.schema === 3) {
    validateStore(input);
    incoming = input.records;
    source = "v3";
  } else if (input.v === 2) {
    incoming = legacyRecords(input);
    source = "legacy v2";
  } else {
    incoming = baselineRecords(input);
    source = "manual baseline";
  }
  const result = clone(current);
  let added = 0,
    duplicates = 0,
    conflicts = 0;
  for (const r of incoming.filter(
    (r) => athletes.includes(r.athlete) || r.athlete === "both",
  )) {
    const existing = result.records.find((e) => e.id === r.id);
    if (!existing) {
      result.records.push(clone(r));
      added++;
    } else if (canonical(existing) === canonical(r)) {
      duplicates++;
    } else {
      const id = `${r.id}:${canonical(r)}`;
      if (!result.conflicts.some((c) => c.id === id)) {
        result.conflicts.push({
          id,
          incoming: clone(r),
          existing: clone(existing),
          resolved: false,
        });
        conflicts++;
      }
    }
  }
  // Retain source envelopes, unknown fields and all revisions losslessly, never in Git.
  const envelope = { source, athletes: [...athletes], data: clone(input) };
  // v3 envelopes are already retained; avoid recursive growth on repeated phone merges.
  const envelopes = source === "v3" ? input.imports : [envelope];
  for (const e of envelopes)
    if (!result.imports.some((x) => canonical(x) === canonical(e)))
      result.imports.push(clone(e));
  if (source === "v3") {
    for (const k of ["conflicts", "revisions"])
      for (const r of input[k].filter((r) => {
        const a = (r.record || r.incoming)?.athlete;
        return !a || athletes.includes(a) || a === "both";
      }))
        if (!result[k].some((e) => canonical(e) === canonical(r)))
          result[k].push(clone(r));
    for (const [k, v] of Object.entries(input.settings).filter(
      ([k]) =>
        !k.match(/^(pace|step):[zh]/) || athletes.includes(k.split(":")[1]),
    ))
      if (!(k in result.settings)) result.settings[k] = clone(v);
      else if (canonical(result.settings[k]) !== canonical(v)) {
        const id = `setting:${k}:${canonical(v)}`;
        if (!result.conflicts.some((c) => c.id === id))
          result.conflicts.push({
            id,
            setting: k,
            incoming: { id, value: v },
            existing: { value: result.settings[k] },
            resolved: false,
          });
      }
  }
  validateStore(result);
  return {
    data: result,
    added,
    duplicates,
    conflicts: result.conflicts.filter((c) => !c.resolved).length,
  };
}
export function updateRecord(store, record) {
  if (record.type === "set") validateSet(record);
  const next = clone(store),
    index = next.records.findIndex((r) => r.id === record.id);
  if (index >= 0) {
    if (canonical(next.records[index]) === canonical(record)) return next;
    next.revisions.push({
      savedAt: new Date().toISOString(),
      record: next.records[index],
    });
    next.records[index] = record;
  } else next.records.push(record);
  return next;
}
export function resolveConflict(store, index, useIncoming) {
  const next = clone(store),
    c = next.conflicts[index];
  assert(c && !c.resolved, "Conflict already resolved");
  c.resolved = true;
  c.choice = useIncoming ? "incoming" : "existing";
  if (useIncoming) {
    if (c.setting) next.settings[c.setting] = clone(c.incoming.value);
    else return updateRecord(next, clone(c.incoming));
  }
  return next;
}
export function readStore(storage) {
  const raw = storage.getItem(KEY);
  if (raw) return validateStore(safeParse(raw));
  let data = fresh();
  const old = storage.getItem("blueline.log.v2");
  if (old) data = importData(data, safeParse(old)).data;
  const state = storage.getItem("blueline3");
  if (state) data.settings.legacyUIRaw = state;
  storage.setItem(KEY, JSON.stringify(data));
  return data;
}
export function persist(storage, next, expected) {
  validateStore(next);
  const raw = storage.getItem(KEY);
  assert(
    raw === expected,
    "Another tab changed your data. Reload before saving; your input is still on screen.",
  );
  // A failed quota write leaves both original and current keys intact.
  storage.setItem(KEY, JSON.stringify(next));
  return JSON.stringify(next);
}
export function checkpoints(storage, current) {
  storage.setItem(`${KEY}.rollback`, JSON.stringify(current));
}
export function setSlots(e) {
  return Array.from({ length: e.sets }, (_, i) =>
    (e.unilateral ? ["L", "R"] : [""]).map((side) => ({
      index: i,
      side,
      key: `${i}${side}`,
    })),
  ).flat();
}
export function sessionStatus(store, s, date) {
  const status = store.records.find((r) => r.id === `session:${s.id}`)?.status;
  if (status) return status;
  if (!s.exercises.length) return "rest";
  if (store.records.some((r) => r.type === "set" && r.sessionId === s.id))
    return "started";
  return date && date < new Date().toLocaleDateString("en-CA")
    ? "missed"
    : "planned";
}
