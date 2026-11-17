import { rtsEstimate } from "./rts.js";
import * as M from "./model.js";
import * as C from "./calculations.js";
import { validateProgram, effectiveSession, sessionRecord } from "./program.js";
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
let program,
  store,
  expected,
  athlete = "z",
  week = 1,
  day = "Monday",
  view = "Today",
  pending,
  historyExercise = "barbell-z-press",
  noticeTimer;
function notify(text) {
  $("#notice").textContent = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => ($("#notice").textContent = ""), 10000);
}
function save(next) {
  expected = M.persist(localStorage, next, expected);
  store = next;
}
function download(data, name = "flyfightwin-backup.json") {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let historicalSessionId = null;
const session = () => {
  const saved =
    historicalSessionId &&
    store.records.find(
      (r) => r.type === "session" && r.sessionId === historicalSessionId,
    );
  return (
    saved?.prescriptionSnapshot ||
    effectiveSession(
      store,
      program.sessions.find(
        (s) => s.week === week && s.day === day && s.athlete === athlete,
      ),
    )
  );
};
const recs = (s) =>
  store.records.filter(
    (r) => r.type === "set" && r.sessionId === s.id && r.athlete === athlete,
  );
const setId = (s, e, slot) => `set:${s.id}:${e.id}:${slot.key}`;
const increment = (e) =>
  store.settings[`step:${athlete}:${e.exerciseId}`] ||
  (e.loadUnit === "lb per hand" ? 2.5 : 5);
function dateFor(s) {
  const start = store.settings.startDate;
  if (!start) return "";
  const d = new Date(`${start}T12:00:00`);
  d.setDate(d.getDate() + (s.week - 1) * 7 + days.indexOf(s.day));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function field(name, label, value = "", type = "number", attrs = "") {
  return `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value ?? "")}" ${type === "number" ? 'inputmode="decimal" step="any"' : ""} ${attrs}></label>`;
}
function render() {
  $(".brand span").textContent =
    `ATHLETIC STRENGTH / ${String(program.weeks).padStart(2, "0")} WEEKS`;
  $("#app").innerHTML =
    `<div class="layout"><aside class="rail"><p class="eyebrow">Athlete</p><div class="profile" role="group" aria-label="Athlete">${["z", "h"].map((a) => `<button data-athlete="${a}" aria-pressed="${athlete === a}">${a === "z" ? "Zack" : "Hannah"}</button>`).join("")}</div><label class="week-control">Training block<select id="week">${Array.from({ length: program.weeks }, (_, i) => `<option value="${i + 1}" ${week === i + 1 ? "selected" : ""}>Week ${String(i + 1).padStart(2, "0")}${program.sessions.some((s) => s.week === i + 1 && s.athlete === athlete && s.reduced) ? " · Reduced volume" : ""}</option>`).join("")}</select></label><div class="days" aria-label="Training days">${days
      .map((d) => {
        const s = program.sessions.find(
          (s) => s.week === week && s.day === d && s.athlete === athlete,
        );
        return `<button data-day="${d}" aria-pressed="${day === d}" aria-label="${d}"><span>${d.slice(0, 3)}</span><small>${M.sessionStatus(store, s, dateFor(s))}</small></button>`;
      })
      .join(
        "",
      )}</div><div class="rail-note"><p>Strength. Power.<br>Aerobic capacity.</p><p class="muted">One session at a time.<br>Saved on this browser only.</p><a href="legacy.html">28-week archive</a></div></aside><main id="content"><nav class="tabs" aria-label="App sections">${["Today", "Plan", "Progress", "History"].map((v) => `<button data-view="${v}" aria-pressed="${view === v}">${v}</button>`).join("")}</nav>${view === "Today" ? workout() : view === "Plan" ? plan() : view === "Progress" ? progress() : history()}</main></div>`;
  bind();
}
function workout() {
  const s = session(),
    saved = recs(s),
    done = saved.filter((r) => r.status === "done").length;
  return `<section class="workout-head"><p class="eyebrow">Week ${String(week).padStart(2, "0")} / ${day} · ${athlete === "z" ? "Zack" : "Hannah"}</p><h1>${esc(s.title)}</h1><div class="meta"><span>${dateFor(s) || "Undated block"}</span><span>·</span><span>${M.sessionStatus(store, s, dateFor(s))}</span><span>·</span><span>${done} sets recorded</span>${s.reduced ? '<span class="tag">Reduced volume</span>' : ""}</div>${s.exercises.length ? `<div class="actions"><button id="startSession">Start session</button><button id="completeSession" class="primary">Complete session</button></div>` : ""}<p class="hint">${esc(s.note)}</p>${store.records.find((r) => r.type === "session" && r.sessionId === s.id)?.programVersion && store.records.find((r) => r.type === "session" && r.sessionId === s.id).programVersion !== program.id ? '<p class="warning">Saved session prescription retained from an earlier program revision. Updates apply to unstarted sessions.</p>' : ""}</section>
 ${s.restDay ? '<section class="card"><h2>Make room for recovery.</h2><p>Off. No makeup sessions.</p></section>' : ""}
 ${s.exercises.some((e) => e.kind === "run" && !e.warmup) ? paceCard() : ""}
 ${s.exercises.map((e) => exercise(s, e)).join("")}<p class="provenance">Approved program · ${esc(s.approvalSource || `PDF page ${s.sourcePage}`)} · ${esc(store.records.find((r) => r.type === "session" && r.sessionId === s.id)?.programVersion || program.id)}</p>`;
}
function paceCard() {
  const ref =
    recs(session()).find((r) => r.paceReference)?.paceReference ||
    C.activeReference(store, athlete, program.paceDefaults);
  return `<section class="card"><p class="eyebrow">Active pace reference</p><h2>${ref.value ? `VDOT ${ref.value.toFixed(1)}` : "Baseline pending"}</h2><p class="hint">${esc(ref.source)}</p>${ref.value ? `<div class="meta">${["E", "T", "I", "R", "2M"].map((t) => `<span>${t} ${C.clock(C.pace(ref.value, t))}/mi</span>`).join("")}</div>` : ""}<p class="hint">Effort and the prescribed recovery govern. Nonmaximal runs never update VDOT. Choose or pin a reference in Progress.</p></section>`;
}
function exercise(s, e) {
  if (e.warmup)
    return `<section class="card prep"><div class="exercise-heading"><span class="group">${e.group}</span><div><h3>${esc(e.name)}</h3><p class="hint">${e.sets} × ${esc(e.prescription)} · ${esc(e.intensity)} · ${esc(e.rest)}</p><small>Preparation / recovery · not counted as working sets</small></div></div></section>`;
  const all = M.setSlots(e),
    rows = all
      .map((slot) => store.records.find((r) => r.id === setId(s, e, slot)))
      .filter(Boolean),
    last = C.matchedHistory(store, athlete, e.exerciseId, e.loadUnit)
      .filter((r) => r.sessionId !== s.id)
      .at(-1),
    load = C.loading(store, athlete, e, increment(e));
  const paceRef =
      recs(s).find((r) => r.paceReference)?.paceReference ||
      C.activeReference(store, athlete, program.paceDefaults),
    paceType =
      e.kind === "run"
        ? /Current 2-mile/.test(e.intensity)
          ? "2M"
          : e.intensity.match(/^([ETIR])(?:[ ;(]|$)/)?.[1]
        : null;
  const top = rows.find(
      (r) =>
        r.slot === 0 &&
        r.status === "done" &&
        r.variant === e.exerciseId &&
        r.unit === e.loadUnit,
    ),
    back = C.backoff(top?.load, e, increment(e));
  const lastSession = last
    ? C.matchedHistory(store, athlete, e.exerciseId, e.loadUnit).filter(
        (r) => r.sessionId === last.sessionId,
      )
    : [];
  return `<section class="card exercise" data-exercise="${esc(e.id)}"><div class="exercise-heading"><span class="group">${e.group}</span><div><h2>${esc(e.name)}</h2><small>${e.optional ? "Optional · only if recovered" : "Working sets"}${e.unilateral ? " · record left and right separately" : ""}</small></div></div><p class="prescription">${e.top || /\d+\s*x\s*\d/.test(e.prescription) ? "" : `${e.sets} × `}${esc(e.prescription)}</p><p class="hint">${esc(e.intensity)} · Rest: ${esc(e.rest)}</p>
 ${paceType && paceRef.value ? `<div class="target"><strong>${paceType} · ${C.clock(C.pace(paceRef.value, paceType))}/mi</strong><p>From active reference: ${esc(paceRef.source)}</p></div>` : ""}
 ${e.device ? '<p class="warning">Verify this mode and firmware on your device. Record its own setting; simulated yards/resistance are not equivalent to a physical sled. No replacement is assumed.</p>' : ""}
 ${/heavy sandbag front/.test(e.name) ? '<p class="warning">Equipment review: confirm an appropriate heavy front-carry implement before this exercise. Do not substitute a light bag or a different implement silently.</p>' : ""}
 ${/Leg press/.test(e.name) && athlete === "h" ? '<p class="hint">Equipment may be unavailable at home. This finisher remains optional.</p>' : ""}
 ${e.top || /^(Hang power clean|Push press|DB push press)$/.test(e.name) ? `<div class="target"><strong>${load.range ? `${load.range.join("–")} ${e.loadUnit} suggested` : "RPE-guided ramp"}</strong>${load.band ? `<p>Initial fallback band ${load.band.join("–")}% of unadjusted Epley e1RM${load.referenceRange ? `: ${load.referenceRange.join("–")} lb from the unadjusted Epley estimate (~${Math.round(load.max)} lb). Fallback reference only; RTS guidance above takes priority.` : ""} · RPE cap ${e.rpeCap} takes priority</p>` : ""}<p>${esc(load.source)}</p>${e.top ? `<p><b>Back-offs:</b> ${back ? `${back.join("–")} lb from saved top set (${top.load} lb)` : `Pending actual top set · ${e.top.backPercent.join("–")}% of actual top weight`}</p>` : ""}</div>` : ""}
 <details class="log" ${e.top ? "open" : ""}><summary>Log sets <small>· ${rows.length}/${all.length} recorded or skipped</small></summary><p class="hint">Targets above are planned. Fields below are actual results; nothing is filled automatically.</p>${all.map((slot) => setForm(s, e, slot)).join("")}</details>
 ${e.kind === "strength" ? `<details><summary>Load increment & progression</summary><label>Available increment (${esc(e.loadUnit)})<input data-increment="${esc(e.exerciseId)}" type="number" min="0.25" step="0.25" value="${increment(e)}"></label><p class="hint">${esc(C.doubleProgression(e, rows.length ? rows.filter((r) => r.variant === e.exerciseId && r.unit === e.loadUnit) : lastSession, increment(e)))}</p></details>` : ""}
 <div class="last">${last ? `Last matched variant · ${esc(last.date)} · ${last.load ?? "—"} ${esc(last.unit)} × ${last.reps ?? "—"} · RIR ${last.rir ?? "unknown"}` : "No recorded history for this exact variant yet."}</div></section>`;
}
function setForm(s, e, slot) {
  const r = store.records.find((r) => r.id === setId(s, e, slot)) || {},
    isRun = e.kind === "run",
    isDistance = !isRun && e.prescription.includes("yd"),
    distanceUnit = isRun ? (/\bm\b/.test(e.prescription) ? "m" : "mi") : "yd";
  return `<form class="set-form" data-e="${esc(e.id)}" data-slot="${slot.key}"><div class="set-head"><b>${e.top ? (slot.index === 0 ? "Top set" : `Back-off ${slot.index}`) : `Set ${slot.index + 1}`}${slot.side ? " · " + slot.side : ""}</b><span>${r.status ? esc(r.status) + " · saved" : "Not recorded"}</span></div><div class="fields">${isRun ? field("seconds", "Time (seconds)", r.seconds, "number", 'min="0"') + field("distance", `Distance (${distanceUnit})`, r.distance, "number", 'min="0"') + field("rpe", "RPE · optional", r.rpe, "number", 'min="1" max="10"') : isDistance ? field("load", e.loadUnit, r.load) + field("distance", e.device ? "Simulated yards" : "Yards", r.distance, "number", 'min="0"') + field("rpe", "RPE", r.rpe, "number", 'min="1" max="10"') : field("load", e.loadUnit, r.load) + field("reps", /sequences/.test(e.prescription) ? "Sequences" : "Reps", r.reps, "number", 'min="0" step="1"') + field("rir", "RIR · optional", r.rir, "number", 'min="0" max="10"')}</div>
 <details><summary>Effort, variant & notes</summary><div class="fields two">${!isRun ? (isDistance ? field("reps", "Reps", r.reps, "number", 'min="0"') + field("rir", "RIR", r.rir, "number", 'min="0" max="10"') : field("rpe", "RPE", r.rpe, "number", 'min="1" max="10"')) + field("seconds", "Time (seconds)", r.seconds, "number", 'min="0"') + (isDistance ? "" : field("distance", `Distance (${distanceUnit}${e.device ? " simulated" : ""})`, r.distance, "number", 'min="0"')) : ""}${field("date", "Performed date", r.date || today(), "date", "required")}${
   !isRun
     ? `<label>Load unit<select name="unit">${[
         e.loadUnit,
         "lb total",
         "lb per hand",
         "lb added / assistance",
         "device setting",
         "bodyweight",
       ]
         .filter((v, i, a) => a.indexOf(v) === i)
         .map(
           (v) =>
             `<option ${v === (r.unit || e.loadUnit) ? "selected" : ""}>${v}</option>`,
         )
         .join("")}</select></label>`
     : ""
 }</div>${!isRun ? `<div class="fields two">${field("rpeLow", "Actual RPE range · low", r.rpeRange?.[0], "number", 'min="1" max="10" step="0.5"')}${field("rpeHigh", "Actual RPE range · high", r.rpeRange?.[1], "number", 'min="1" max="10" step="0.5"')}</div><p class="hint">Use one actual RPE or a range. Leave both blank if effort was not recorded.</p>` : ""}${field("variant", "Actual variant (different variants stay separate)", r.variant || e.exerciseId, "text", "required")}${e.device ? field("deviceMode", "Device mode / firmware (as displayed)", r.deviceMode, "text") : ""}<label>Notes / quality / reason skipped<textarea name="notes">${esc(r.notes)}</textarea></label></details><div class="actions"><button class="primary" type="submit" name="status" value="done">${r.status ? "Update" : "Save"} set</button><button type="submit" name="status" value="skipped">Skip set</button></div></form>`;
}
function plan() {
  const ss = program.sessions
    .filter((s) => s.week === week && s.athlete === athlete)
    .map((s) => effectiveSession(store, s))
    .sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day));
  return `<p class="eyebrow">The training week</p><h1>Consistency, with intent.</h1><p class="muted">Your approved sessions, organized by week.</p><section class="card"><label>Block start date · Week 1 Monday<input id="startDate" type="date" value="${esc(store.settings.startDate)}"></label><p class="hint">Choose your own date. This schedules the plan; it does not mark past sessions completed.</p></section><div class="plan-grid">${ss.map((s) => `<button class="card" data-plan="${s.day}"><span class="eyebrow">${s.day} · ${M.sessionStatus(store, s, dateFor(s))}</span><strong>${esc(s.title)}</strong><small>${dateFor(s) || "No date selected"} · ${s.exercises.filter((e) => !e.warmup).length} exercises</small></button>`).join("")}</div><details class="card"><summary>Block progression · original source overview</summary>${program.overview.map((o) => `<details><summary>PDF page ${o.page}</summary><pre>${esc(o.text)}</pre></details>`).join("")}</details>`;
}
function progress() {
  const refs = C.runReferences(store, athlete),
    active = C.activeReference(store, athlete, program.paceDefaults),
    sets = store.records.filter(
      (r) => r.athlete === athlete && r.type === "set" && r.status === "done",
    ),
    sessions = store.records.filter(
      (r) =>
        r.athlete === athlete &&
        r.type === "session" &&
        r.sessionId.startsWith(program.blockId + ":"),
    ),
    variants = [
      ...new Set([
        ...program.sessions
          .filter((s) => s.athlete === athlete)
          .flatMap((s) =>
            s.exercises
              .filter((e) => !e.warmup && e.kind === "strength")
              .map((e) => e.exerciseId),
          ),
        ...sets.map((r) => r.variant),
      ]),
    ],
    hist = C.matchedHistory(store, athlete, historyExercise);
  const points = hist.filter((r) => r.load != null),
    vals = points.map((r) => r.load),
    lo = Math.min(...vals),
    hi = Math.max(...vals),
    coords = points
      .map(
        (r, i) =>
          `${20 + (i * 560) / Math.max(1, points.length - 1)},${105 - ((r.load - lo) / Math.max(1, hi - lo)) * 80}`,
      )
      .join(" ");
  return `<p class="eyebrow">Progress / ${athlete === "z" ? "Zack" : "Hannah"}</p><h1>Build on what you record.</h1><div class="stats"><div><b>${sessions.filter((r) => r.status === "completed").length}/${program.sessions.filter((s) => s.athlete === athlete && !s.restDay).length}</b><small>Completed sessions</small></div><div><b>${sets.length}</b><small>Recorded sets</small></div><div><b>${active.value?.toFixed(1) || "—"}</b><small>Active VDOT</small></div></div><section class="card"><h2>Exercise history</h2><label>Exact exercise variant<select id="historyExercise">${variants.map((v) => `<option value="${esc(v)}" ${v === historyExercise ? "selected" : ""}>${esc(v.replaceAll("-", " "))}</option>`).join("")}</select></label><p class="hint">Recorded load by set, chronological. Compare like units and repetitions. Eligible barbell estimates use the supplied RTS chart and recorded RPE. Unadjusted Epley values are labeled fallback references; neither method is a tested max.</p>${points.length > 1 && new Set(points.map((r) => r.unit)).size === 1 ? `<svg class="chart" viewBox="0 0 600 130" role="img" aria-label="Recorded load trend; exact values listed below"><polyline points="${coords}" fill="none" stroke="#DFC780" stroke-width="3"/>${points.map((r, i) => `<circle cx="${20 + (i * 560) / Math.max(1, points.length - 1)}" cy="${105 - ((r.load - lo) / Math.max(1, hi - lo)) * 80}" r="4" fill="#F8F3E6"/>`).join("")}</svg>` : ""}${
    hist.length
      ? `<ul class="list">${hist
          .slice()
          .reverse()
          .map(
            (r) =>
              `<li><b>${esc(r.date || "Date unknown")}</b> · ${r.load ?? "—"} ${esc(r.unit)} × ${r.reps ?? "—"}<p>RPE ${r.rpeRange?.join("–") ?? r.rpe ?? "unknown"} · RIR ${r.rir ?? "unknown"}${rtsEstimate(r) || (C.supportsMax(r.variant) && C.e1rm(r.load, r.reps)) ? ` · ${rtsEstimate(r) ? `RTS estimated 1RM ${rtsEstimate(r).range.map(Math.round).join("–")} lb` : `Epley fallback reference ${Math.round(C.e1rm(r.load, r.reps))} lb (unadjusted)`}` : ""}</p><small>${esc(r.provenance || "Performed; entered in this app")} · ${esc(r.notes)}</small></li>`,
          )
          .join("")}</ul>`
      : '<p class="empty">Your first recorded set starts this history.</p>'
  }</section><section class="card"><h2>Running references</h2><p>${esc(active.source)}</p><label>Pin a pace reference<select id="paceReference"><option value="">${esc(program.paceDefaults[athlete].autoNewTests ? "Automatic · new two-mile tests" : "Default · approved program reference")}</option>${program.paceDefaults[athlete].value ? `<option value="program" ${["pdf", "program"].includes(store.settings["pace:" + athlete]) ? "selected" : ""}>Pin program reference · ${program.paceDefaults[athlete].value}</option>` : ""}${refs.map((r) => `<option value="${esc(r.id)}" ${store.settings["pace:" + athlete] === r.id ? "selected" : ""}>${esc(r.source)} · ${r.value.toFixed(2)}</option>`).join("")}</select></label><p class="hint">All previous tests remain available. A nonmaximal run never becomes a pace test. The written prescription stays intact; choosing another pace reference is your explicit override.</p>${refs.map((r) => `<p class="hint">${esc(r.source)} · VDOT ${r.value.toFixed(2)}</p>`).join("")}</section>`;
}
function history() {
  const records = store.records.filter((r) => r.athlete === athlete),
    conflicts = store.conflicts
      .map((c, i) => ({ ...c, index: i }))
      .filter((c) => !c.resolved);
  return `<p class="eyebrow">History & backups</p><h1>Your work stays yours.</h1><p class="muted">This browser holds your records. Transfer a JSON backup to combine both phones; there is no live synchronization.</p><section class="card"><h2>Backup & restore</h2><div class="actions"><button id="export" class="primary">Export full backup</button><button id="rollback">Undo last import / restore</button></div><label>Import records for<select id="importAthlete"><option value="both">Both athletes</option><option value="z">Zack only</option><option value="h">Hannah only</option></select></label><label class="file">Choose v2, v3 or baseline JSON<input id="importFile" type="file" accept="application/json,.json"></label><p class="hint">Preview first. A download and a browser rollback checkpoint are created before merging. Conflicting values are retained for your decision. Original browser keys remain intact.</p><a href="docs/MIGRATION.md">Phone migration & rollback instructions</a></section>
 ${conflicts.length ? `<section class="card"><h2>${conflicts.length} conflicts need review</h2><p>Current values remain active until you choose. Both copies are retained.</p>${conflicts.map((c) => `<details><summary>${esc(c.setting || c.incoming.id)}</summary><h3>Current</h3><pre>${esc(JSON.stringify(c.existing, null, 2))}</pre><h3>Incoming</h3><pre>${esc(JSON.stringify(c.incoming, null, 2))}</pre><div class="actions"><button data-conflict="${c.index}" data-choice="keep">Keep current</button><button data-conflict="${c.index}" data-choice="incoming">Use incoming</button></div></details>`).join("")}</section>` : ""}
 <section class="card"><h2>Recorded activity · ${athlete === "z" ? "Zack" : "Hannah"}</h2>${
   records.length
     ? `<ul class="list">${records
         .slice()
         .reverse()
         .map(
           (r) =>
             `<li><b>${esc(r.type === "set" ? r.variant.replaceAll("-", " ") : r.type === "legacy" ? `Legacy ${r.category} · ${r.key}` : r.type)}</b><p>${r.type === "set" ? `${esc(r.date)} · ${r.status} · ${r.load ?? "—"} ${esc(r.unit)} · ${r.reps ?? "—"} reps · ${r.seconds ?? "—"} sec` : esc(r.provenance || r.status || r.date)}</p>${r.type === "set" && r.sessionId !== "historical-baseline" ? `<button data-edit="${esc(r.sessionId)}">Edit session</button>` : ""}<details><summary>Original details</summary><pre>${esc(JSON.stringify(r, null, 2))}</pre></details></li>`,
         )
         .join("")}</ul>`
     : '<p class="empty">No completed activity has been invented. Import your backup or record your first session.</p>'
 }</section><section class="card"><h2>Preserved history</h2><p>${store.imports.length} source imports · ${store.revisions.length} prior record revisions retained in your full backup.</p><a href="legacy.html">Open original 28-week archive</a><p class="hint">The archive reads original local data. It cannot overwrite those keys; new edits belong in this application.</p><a class="review-link" href="REVIEW_REQUIRED.md">Program and equipment review items</a></section>`;
}
function bind() {
  document.querySelectorAll("[data-athlete]").forEach(
    (b) =>
      (b.onclick = () => {
        historicalSessionId = null;
        athlete = b.dataset.athlete;
        render();
      }),
  );
  $("#week").onchange = (e) => {
    historicalSessionId = null;
    week = +e.target.value;
    render();
  };
  document.querySelectorAll("[data-day]").forEach(
    (b) =>
      (b.onclick = () => {
        historicalSessionId = null;
        day = b.dataset.day;
        render();
      }),
  );
  document.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.view;
        render();
      }),
  );
  document.querySelectorAll("[data-plan]").forEach(
    (b) =>
      (b.onclick = () => {
        historicalSessionId = null;
        day = b.dataset.plan;
        view = "Today";
        render();
      }),
  );
  document.querySelectorAll("[data-edit]").forEach(
    (b) =>
      (b.onclick = () => {
        const s =
          program.sessions.find((s) => s.id === b.dataset.edit) ||
          store.records.find(
            (r) => r.type === "session" && r.sessionId === b.dataset.edit,
          )?.prescriptionSnapshot;
        if (s) {
          historicalSessionId = s.id;
          week = s.week;
          day = s.day;
          view = "Today";
          render();
        }
      }),
  );
  $("#startSession")?.addEventListener("click", () =>
    guard(() => {
      const s = session();
      save(
        M.updateRecord(
          store,
          sessionRecord(store, program, s, "started", today()),
        ),
      );
      render();
      notify("Session started. Record actual sets as you go.");
    }),
  );
  $("#completeSession")?.addEventListener("click", () =>
    guard(() => {
      const s = session(),
        required = s.exercises
          .filter((e) => !e.warmup && !e.optional)
          .flatMap((e) => M.setSlots(e).map((slot) => setId(s, e, slot))),
        r = recs(s);
      if (
        !required.every((id) => r.some((x) => x.id === id)) ||
        !r.some((x) => x.status === "done")
      )
        throw Error(
          "Record or explicitly skip every required set before completing. At least one actual set is required.",
        );
      save(
        M.updateRecord(
          store,
          sessionRecord(store, program, s, "completed", today()),
        ),
      );
      render();
      notify("Session completed.");
    }),
  );
  document.querySelectorAll(".set-form").forEach(
    (form) =>
      (form.onsubmit = (event) => {
        event.preventDefault();
        guard(() => {
          const s = session(),
            e = s.exercises.find((e) => e.id === form.dataset.e),
            slot = M.setSlots(e).find((x) => x.key === form.dataset.slot),
            fd = new FormData(form),
            status = event.submitter.value;
          const r = {
            id: setId(s, e, slot),
            type: "set",
            athlete,
            sessionId: s.id,
            exerciseId: e.exerciseId,
            slot: slot.index,
            side: slot.side,
            variant: fd.get("variant").trim(),
            date: fd.get("date"),
            unit: fd.get("unit") || "running",
            distanceUnit:
              e.kind === "run"
                ? /\bm\b/.test(e.prescription)
                  ? "m"
                  : "mi"
                : "yd",
            deviceMode: fd.get("deviceMode") || null,
            notes: fd.get("notes"),
            status,
            updatedAt: new Date().toISOString(),
            prescriptionSnapshot: M.clone(e),
            paceReference:
              e.kind === "run"
                ? M.clone(
                    store.records.find((x) => x.id === setId(s, e, slot))
                      ?.paceReference ||
                      C.activeReference(store, athlete, program.paceDefaults),
                  )
                : null,
            programVersion:
              store.records.find(
                (r) => r.type === "session" && r.sessionId === s.id,
              )?.programVersion || program.id,
            provenance: "performed; entered in app",
          };
          for (const k of ["load", "reps", "seconds", "distance", "rpe", "rir"])
            r[k] =
              fd.get(k) == null || fd.get(k) === "" ? null : Number(fd.get(k));
          const rpeLow = fd.get("rpeLow"),
            rpeHigh = fd.get("rpeHigh");
          if (rpeLow || rpeHigh) {
            if (!rpeLow || !rpeHigh)
              throw Error("Enter both actual RPE range endpoints.");
            r.rpeRange = [Number(rpeLow), Number(rpeHigh)];
          }
          if (!r.date || !r.variant)
            throw Error("Date and variant are required.");
          if (status === "skipped" && !r.notes.trim())
            throw Error("Add a short reason in Notes before skipping.");
          let next = M.updateRecord(
            store,
            sessionRecord(store, program, s, "started", today()),
          );
          next = M.updateRecord(next, r);
          save(next);
          const scrollY = window.scrollY;
          const open = [...document.querySelectorAll("details.log[open]")].map(
            (d) => d.closest(".exercise").dataset.exercise,
          );
          render();
          for (const id of open)
            document.querySelector(
              `.exercise[data-exercise="${CSS.escape(id)}"] details.log`,
            ).open = true;
          requestAnimationFrame(() => window.scrollTo(0, scrollY));
          notify(
            status === "done"
              ? "Set saved. Previous version retained."
              : "Set skipped with reason.",
          );
        });
      }),
  );
  document.querySelectorAll("[data-increment]").forEach(
    (input) =>
      (input.onchange = () =>
        guard(() => {
          const n = +input.value;
          if (!(n >= 0.25 && n <= 100))
            throw Error("Choose an increment between 0.25 and 100.");
          const next = M.clone(store);
          next.settings[`step:${athlete}:${input.dataset.increment}`] = n;
          save(next);
          render();
        })),
  );
  $("#startDate")?.addEventListener("change", (e) =>
    guard(() => {
      if (
        e.target.value &&
        new Date(`${e.target.value}T12:00:00`).getDay() !== 1
      )
        throw Error("Choose a Monday for Week 1.");
      const next = M.clone(store);
      next.settings.startDate = e.target.value;
      save(next);
      render();
    }),
  );
  $("#historyExercise")?.addEventListener("change", (e) => {
    historyExercise = e.target.value;
    render();
  });
  $("#paceReference")?.addEventListener("change", (e) =>
    guard(() => {
      const next = M.clone(store);
      next.settings[`pace:${athlete}`] = e.target.value;
      save(next);
      render();
    }),
  );
  $("#export")?.addEventListener("click", () => download(store));
  $("#importFile")?.addEventListener("change", async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 12000000) throw Error("File exceeds 12 MB.");
      const input = M.safeParse(await file.text()),
        choice = $("#importAthlete").value;
      pending = M.importData(
        store,
        input,
        choice === "both" ? ["z", "h"] : [choice],
      );
      $("#importPreview").innerHTML =
        `<p>${pending.added} new records · ${pending.duplicates} duplicates · ${pending.conflicts} unresolved conflicts.</p><p>Existing records and original storage remain preserved. Conflicts require a separate choice after import.</p>`;
      $("#importDialog").showModal();
    } catch (err) {
      notify(err.message);
    }
  });
  $("#rollback")?.addEventListener("click", () =>
    guard(() => {
      const raw = localStorage.getItem(`${M.KEY}.rollback`);
      if (!raw) throw Error("No rollback checkpoint exists yet.");
      if (
        !confirm(
          "Restore the last checkpoint? Your current data will be exported and retained as the next rollback checkpoint.",
        )
      )
        return;
      const next = M.validateStore(M.safeParse(raw));
      download(store, "flyfightwin-before-rollback.json");
      M.checkpoints(localStorage, store);
      save(next);
      render();
      notify("Checkpoint restored. Current data was backed up.");
    }),
  );
  document.querySelectorAll("[data-conflict]").forEach(
    (b) =>
      (b.onclick = () =>
        guard(() => {
          save(
            M.resolveConflict(
              store,
              +b.dataset.conflict,
              b.dataset.choice === "incoming",
            ),
          );
          render();
        })),
  );
}
function guard(fn) {
  try {
    fn();
  } catch (e) {
    notify(e.message);
  }
}
$("#cancelImport").onclick = () => {
  $("#importDialog").close();
  pending = null;
};
$("#confirmImport").onclick = () =>
  guard(() => {
    if (!pending) return;
    download(store, "flyfightwin-before-import.json");
    M.checkpoints(localStorage, store);
    save(pending.data);
    pending = null;
    $("#importDialog").close();
    render();
    notify("Import saved. Review any conflicts below.");
  });
window.addEventListener("storage", (e) => {
  if (e.key === M.KEY)
    notify("Data changed in another tab. Reload before editing.");
});
try {
  program = validateProgram(await (await fetch("data/program.json")).json());
  store = M.readStore(localStorage);
  expected = localStorage.getItem(M.KEY);
  render();
} catch (e) {
  $("#app").innerHTML =
    `<section class="card"><h1>Your data is protected.</h1><p>${esc(e.message)}</p><p>Loading stopped without overwriting existing records. Export the raw browser data below before troubleshooting.</p><button id="rescue">Download stored data</button></section>`;
  $("#rescue").onclick = () =>
    download(
      {
        v3: localStorage.getItem(M.KEY),
        v2: localStorage.getItem("blueline.log.v2"),
        ui: localStorage.getItem("blueline3"),
      },
      "flyfightwin-recovery.json",
    );
}
