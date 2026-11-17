import { rtsEligible, rtsEstimate, rtsPercent, actualRpeRange } from "./rts.js";
export const roundLoad = (n, step = 5) => {
  if (!(step > 0) || !Number.isFinite(n)) return null;
  return Math.round(n / step) * step;
};
export function e1rm(load, reps) {
  return load > 0 && reps >= 1 && reps <= 10 ? load * (1 + reps / 30) : null;
}
export const supportsMax = (id) =>
  [
    "barbell-z-press",
    "conventional-barbell-deadlift",
    "reverse-ssb-squat",
    "front-squat",
    "push-press",
    "db-push-press",
  ].includes(id);
export function initialBand(e) {
  if (!e.top) return null;
  const reps = e.top.reps,
    cap = e.rpeCap;
  // Provisional starting ranges, not changes to the PDF's RPE prescription.
  const bands = { 2: [83, 89], 3: [80, 87], 4: [78, 85], 5: [77, 83] };
  const b = bands[reps] || [70, 80];
  return cap <= 7 ? b.map((v) => v - 5) : b;
}
export function backoff(top, e, step = 5) {
  return e.top && top > 0
    ? e.top.backPercent.map((p) => roundLoad((top * p) / 100, step))
    : null;
}
export function matchedHistory(store, athlete, variant, unit) {
  return store.records
    .filter(
      (r) =>
        r.type === "set" &&
        r.athlete === athlete &&
        r.variant === variant &&
        r.status === "done" &&
        (!unit || r.unit === unit),
    )
    .sort(
      (a, b) =>
        (a.date || "").localeCompare(b.date || "") ||
        (a.updatedAt || "").localeCompare(b.updatedAt || ""),
    );
}
// Chart advice is read-only: neither actual records nor prescriptions change.
function repeatExposure(last, e, band, max, step) {
  const referenceRange = max
    ? band.map((p) => roundLoad((max * p) / 100, step))
    : null;
  const reference = { band, max, referenceRange };
  const estimate = rtsEstimate(last),
    effort = actualRpeRange(last);
  const evidence = `Performed ${last.load} lb × ${last.reps} on ${last.date || "unknown date"}; actual RPE ${effort ? effort.join("–") : "unrecorded"}.`;
  if (
    effort &&
    Math.max(...effort) > (last.prescriptionSnapshot?.rpeCap ?? e.rpeCap) &&
    Math.max(...effort) > e.rpeCap
  )
    return {
      ...reference,
      range: null,
      source: `${evidence} This exceeded the current RPE cap of ${e.rpeCap}. Reduce the load and ramp to the prescribed effort.`,
    };
  const target = rtsPercent(e.top.reps, e.rpeCap);
  if (estimate && target != null) {
    const unrounded = estimate.range.map((n) => (n * target) / 100);
    const range = [
      Math.floor((unrounded[0] + 1e-9) / step) * step,
      Math.ceil((unrounded[1] - 1e-9) / step) * step,
    ];
    return {
      ...reference,
      range,
      method: "RTS",
      estimateRange: estimate.range,
      targetPercent: target,
      source: `${evidence} RTS: ${estimate.percent.join("–")}% at the recorded effort → approximately ${estimate.range.map(Math.round).join("–")} lb estimated 1RM. Target ${e.top.reps} reps at RPE ${e.rpeCap}: ${target}%. Rounded outward to available increments; start at the lower load and use the upper only if the RPE cap permits. Reconfirm after a layoff; this is not a tested max.`,
    };
  }
  return {
    ...reference,
    range: null,
    method: "RPE-guided",
    source: `${evidence} ${effort ? "Actual or target reps/RPE are outside the supplied RTS chart." : "Actual effort is missing; prescribed RPE and RIR are not substituted."} Use an RPE-guided ramp. Any unadjusted Epley percentage shown is a fallback reference only, not a recommendation for this submaximal exposure.`,
  };
}
export function loading(store, a, e, step = 5) {
  const band = initialBand(e),
    hist = matchedHistory(store, a, e.exerciseId, e.loadUnit).filter(
      (r) =>
        (rtsEstimate(r) || e1rm(r.load, r.reps)) &&
        (!e.top || r.slot === 0 || r.sessionId === "historical-baseline"),
    );
  const last = hist.at(-1),
    max = supportsMax(e.exerciseId) && last ? e1rm(last.load, last.reps) : null;
  if (band && last && rtsEligible(e.exerciseId))
    return repeatExposure(last, e, band, max, step);
  if (
    !band &&
    last &&
    ["push-press", "db-push-press", "hang-power-clean"].includes(e.exerciseId)
  )
    return {
      band: null,
      range:
        last.rpe != null && last.rpe > e.rpeCap ? null : [last.load, last.load],
      source: `Performed exact-variant load from ${last.date || "unknown date"}; RPE ${last.rpe ?? "unknown"}. This is a repeat-exposure reference, not a max. Reduce for the current effort cap or any loss of speed/quality.`,
    };
  const b = store.records
    .filter((r) => r.type === "baseline" && r.athlete === a)
    .at(-1);
  const mapping = {
    "conventional-barbell-deadlift":
      "conventional_deadlift_top_triple_low_high",
    "front-squat": "front_squat_top_four_low_high",
    "hang-power-clean": "hang_power_clean_fast_doubles",
    "push-press": "push_press_fast_triples",
  };
  const range = b?.value?.provisional_lift_loading_lb?.[mapping[e.exerciseId]];
  if (
    range &&
    (!e.top || e.top.reps === (e.exerciseId === "front-squat" ? 4 : 3)) &&
    e.rpeCap >= 7
  )
    return {
      band,
      range,
      source: `Provisional conversion / user estimate (${b.date}); not tested. Old or different-movement evidence; ramp cautiously.`,
    };
  return {
    band,
    range: null,
    source:
      "Not established for this exact lift. Use a first-exposure ramp to the prescribed RPE cap; stop before grinding.",
  };
}
export function doubleProgression(e, sets, step = 5) {
  const n = e.sets * (e.unilateral ? 2 : 1),
    target = e.repRange;
  if (!target || e.rir == null)
    return "Follow prescribed effort and quality; no automatic increase.";
  if (
    sets.length !== n ||
    sets.some((s) => s.status !== "done" || s.reps == null || s.rir == null)
  )
    return "Hold load. Log every working set and RIR before increasing.";
  if (sets.some((s) => s.rir < e.rir || s.reps < target[0]))
    return `Hold or reduce load to reach ${target[0]}–${target[1]} reps with ${e.rir} RIR.`;
  if (
    new Set(sets.map((s) => s.unit)).size > 1 ||
    new Set(sets.map((s) => s.load)).size > 1
  )
    return "Use a consistent load and unit across all working sets before increasing.";
  if (sets.every((s) => s.reps >= target[1]))
    return `Increase by ${step} ${e.loadUnit}; return to ${target[0]} reps. RIR remains ${e.rir}.`;
  return `Keep load; build all sets toward ${target[1]} reps at ${e.rir} RIR.`;
}
export function vdot(distanceMeters, seconds) {
  const t = seconds / 60,
    v = distanceMeters / t;
  return (
    (-4.6 + 0.182258 * v + 0.000104 * v * v) /
    (0.8 +
      0.1894393 * Math.exp(-0.012778 * t) +
      0.2989558 * Math.exp(-0.1932605 * t))
  );
}
export function timeFor(d, V) {
  let lo = 1,
    hi = 200;
  for (let i = 0; i < 160; i++) {
    const m = (lo + hi) / 2;
    if (vdot(d, m * 60) > V) lo = m;
    else hi = m;
  }
  return ((lo + hi) / 2) * 60;
}
export function pace(V, type) {
  if (!(V > 0)) return null;
  if (type === "2M") return timeFor(3218.69, V) / 2;
  const f = { E: 0.7, M: 0.84, T: 0.88, I: 0.98, R: 1.05 }[type];
  if (!f) return null;
  const v =
    (-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (4.6 + V * f))) /
    (2 * 0.000104);
  return (1609.34 / v) * 60;
}
export const clock = (seconds) =>
  seconds == null
    ? "—"
    : `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, "0")}`;
export function runReferences(store, a) {
  return store.records.flatMap((r) => {
    if (r.athlete !== a) return [];
    if (
      r.type === "legacy" &&
      r.category === "tt" &&
      Number.isFinite(r.value.v)
    )
      return [
        {
          id: r.id,
          value: r.value.v,
          source: `Legacy test week ${r.key} · ${clock(r.value.s)} · date unknown`,
        },
      ];
    if (
      r.type === "set" &&
      r.exerciseId === "2-mile-time-trial" &&
      r.variant === "2-mile-time-trial" &&
      (r.distance == null || (r.distance === 2 && r.distanceUnit === "mi")) &&
      r.status === "done" &&
      r.seconds > 0
    )
      return [
        {
          id: r.id,
          value: vdot(3218.69, r.seconds),
          date: r.date,
          source: `2-mile test · ${r.date} · ${clock(r.seconds)}`,
        },
      ];
    return [];
  });
}
export function activeReference(store, a, policy = {}) {
  const refs = runReferences(store, a),
    pin = store.settings[`pace:${a}`],
    fallback = policy[a] || {
      value: null,
      source: "Choose a valid pace reference.",
      autoNewTests: false,
    };
  if (pin) {
    if (pin === "pdf" || pin === "program")
      return {
        value: fallback.value,
        source: fallback.source + " (pinned program reference)",
      };
    const selected = refs.find((r) => r.id === pin);
    if (selected) return selected;
  }
  if (fallback.autoNewTests) {
    const recent = refs
      .filter((r) => r.id.startsWith("set:"))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .at(-1);
    if (recent) return recent;
  }
  return { value: fallback.value, source: fallback.source };
}
