import * as D from "./drafts.js";
import { rtsEstimate } from "./rts.js";
import * as M from "./model.js";
import * as C from "./calculations.js";
import { validateProgram, effectiveSession } from "./program.js";
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
const setId = D.setId;
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
  return `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value ?? "")}" ${type === "number" ? `inputmode="decimal" ${/\bstep=/.test(attrs) ? "" : 'step="any"'}` : ""} ${attrs}></label>`;
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
  return `<section class="workout-head"><p class="eyebrow">Week ${String(week).padStart(2, "0")} / ${day} · ${athlete === "z" ? "Zack" : "Hannah"}</p><h1>${esc(s.title)}</h1><div class="meta"><span>${dateFor(s) || "Undated block"}</span><span>·</span><span>${M.sessionStatus(store, s, dateFor(s))}</span><span>·</span><span>${done} sets recorded</span>${s.reduced ? '<span class="tag">Reduced volume</span>' : ""}</div>${s.exercises.length ? `<div class="actions"><button id="undoDraft" ${store.drafts?.[s.id]?.undo.length ? "" : "disabled"}>Undo draft edit</button><button id="completeSession" class="primary">Finish Workout</button></div>` : ""}<p id="draftStatus" class="hint" role="status">${store.drafts?.[s.id] ? "Draft saved on this browser." : "Edits autosave as drafts."} Review checked sets before Finish Workout; unchecked required sets are recorded as skipped. Undo applies to draft edits.</p><p class="hint">${esc(s.note)}</p>${(store.records.find((r) => r.type === "session" && r.sessionId === s.id)?.programVersion || store.drafts?.[s.id]?.programVersion || program.id) !== program.id ? '<p class="warning">Saved session prescription retained from an earlier program revision. Updates apply to unstarted sessions.</p>' : ""}</section>
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
function effortField(e) {
  return e.rir != null ? "rir" : "rpe";
}
function slotLabel(e, slot) {
  return `${e.top ? (slot.index === 0 ? "Top" : `B${slot.index}`) : slot.index + 1}${slot.side ? ` ${slot.side}` : ""}`;
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
    load = C.loading(store, athlete, e, increment(e)),
    primary =
      e.top || /^(Hang power clean|Push press|DB push press)$/.test(e.name),
    paceRef =
      recs(s).find((r) => r.paceReference)?.paceReference ||
      C.activeReference(store, athlete, program.paceDefaults),
    paceType =
      e.kind === "run"
        ? /Current 2-mile/.test(e.intensity)
          ? "2M"
          : e.intensity.match(/^([ETIR])(?:[ ;(]|$)/)?.[1]
        : null,
    lastSession = last
      ? C.matchedHistory(store, athlete, e.exerciseId, e.loadUnit).filter(
          (r) => r.sessionId === last.sessionId,
        )
      : [],
    run = e.kind === "run",
    distance = !run && e.prescription.includes("yd"),
    effort = effortField(e);
  return `<section class="card exercise" data-exercise="${esc(e.id)}">
    <header class="compact-heading"><h2><span class="exercise-group">${esc(e.group)}</span>${esc(e.name)}${e.optional ? '<small class="optional-label">Optional</small>' : ""}</h2>
      <p class="prescription">${e.top || /\d+\s*x\s*\d/.test(e.prescription) ? "" : `${e.sets} × `}${esc(e.prescription)}</p>
      <p class="intensity">${esc(e.intensity)} · Rest ${esc(e.rest)}</p></header>
    ${paceType && paceRef.value ? `<p class="compact-target">${paceType} · ${C.clock(C.pace(paceRef.value, paceType))}/mi</p>` : ""}
    ${e.device ? '<p class="warning">Verify mode, firmware and anchor. Record device settings; simulated yards are not physical sled distances.</p>' : ""}
    ${/heavy sandbag front/.test(e.name) ? '<p class="warning">Confirm an appropriate heavy front-carry implement. Do not silently substitute a light bag or another implement.</p>' : ""}
    ${/Leg press/.test(e.name) && athlete === "h" ? '<p class="hint">Equipment may be unavailable at home. This finisher remains optional.</p>' : ""}
    ${primary ? `<div class="target compact-target"><strong>${load.range ? `${load.range.join("–")} ${e.loadUnit} suggested` : "RPE-guided ramp"}${e.rpeCap ? ` · cap ${e.rpeCap}` : ""}</strong>${e.top ? `<p><b>Back-offs:</b> <span class="backoff-target">${esc(backoffText(s, e))}</span></p>` : ""}</div>` : ""}
    <div class="logging-area"><table class="set-table" aria-label="${esc(e.name)} working sets">
      <colgroup><col class="col-set"><col><col class="col-reps"><col class="col-effort"><col class="col-check"></colgroup>
      <thead><tr><th scope="col">Set</th><th scope="col">${run ? "Time · s" : `Weight<small>${esc(e.loadUnit)}</small>`}</th><th scope="col">${run ? `Dist · ${/\bm\b/.test(e.prescription) ? "m" : "mi"}` : distance ? "Yards" : /sequences/.test(e.prescription) ? "Seq" : "Reps"}</th><th scope="col">${effort.toUpperCase()}</th><th scope="col"><span aria-hidden="true">✓</span><span class="sr-only">Completed</span></th></tr></thead>
      <tbody>${all.map((slot) => setRow(s, e, slot)).join("")}</tbody></table>
      <details class="exercise-details"><summary>Details & other effort</summary>
        <p class="hint">${rows.length}/${all.length} finalized or skipped. Check only completed work before Finish Workout. Exact reps are prefilled; effort is actual, optional and never assumed. A direct edit to a finalized set is a pending correction; the old result remains in history until Finish, and its prior version is retained.</p>
        <label>Details for set<select class="advanced-slot">${all.map((slot) => `<option value="${slot.key}">${slotLabel(e, slot)}</option>`).join("")}</select></label>
        <div class="advanced-editor">${advancedFields(s, e, all[0])}</div>
        ${primary ? `<div class="loading-explanation">${load.band ? `<p class="hint">Initial fallback band ${load.band.join("–")}% of unadjusted Epley e1RM${load.referenceRange ? `: ${load.referenceRange.join("–")} lb from the unadjusted estimate (~${Math.round(load.max)} lb). Fallback reference only; RTS takes priority.` : ""} · RPE cap ${e.rpeCap} takes priority.</p>` : ""}<p class="hint">${esc(load.source)}</p></div>` : ""}
        ${paceType && paceRef.value ? `<p class="hint">Pace reference: ${esc(paceRef.source)}</p>` : ""}
        ${e.kind === "strength" ? `<label>Available increment (${esc(e.loadUnit)})<input data-increment="${esc(e.exerciseId)}" type="number" min="0.25" step="0.25" value="${increment(e)}"></label><p class="hint">${esc(C.doubleProgression(e, rows.length ? rows.filter((r) => r.variant === e.exerciseId && r.unit === e.loadUnit) : lastSession, increment(e)))}</p>` : ""}
        <p class="hint">${last ? `Last matched variant · ${esc(last.date)} · ${last.load ?? "—"} ${esc(last.unit)} × ${last.reps ?? "—"} · RIR ${last.rir ?? "unknown"}` : "No recorded history for this exact variant yet."}</p>
      </details></div></section>`;
}
function cell(name, label, value, attrs = "") {
  return `<input name="${name}" aria-label="${esc(label)}" type="number" inputmode="decimal" step="any" value="${esc(value)}" ${attrs}>`;
}
function setRow(s, e, slot) {
  const r = D.row(store, s, e, slot, today()),
    run = e.kind === "run",
    distance = !run && e.prescription.includes("yd"),
    effort = effortField(e),
    label = `${e.name}, ${slotLabel(e, slot)}`,
    saved = store.records.some((r) => r.id === setId(s, e, slot));
  return `<tr class="set-row" data-e="${esc(e.id)}" data-slot="${slot.key}" data-finalized="${saved}">
    <th scope="row" title="${e.top && slot.index ? `Back-off ${slot.index}` : slotLabel(e, slot)}">${slotLabel(e, slot)}</th>
    <td>${cell(run ? "seconds" : "load", `${label}, ${run ? "time in seconds" : e.loadUnit}`, run ? r.seconds : r.load, run ? 'min="0"' : "")}</td>
    <td>${cell(run || distance ? "distance" : "reps", `${label}, ${run || distance ? "distance" : "reps"}`, run || distance ? r.distance : r.reps, 'min="0"')}</td>
    <td>${cell(effort, `${label}, actual ${effort.toUpperCase()}`, r[effort], `min="${effort === "rpe" ? 1 : 0}" max="10"`)}</td>
    <td><label class="cell-check"><input name="checked" type="checkbox" aria-label="${esc(label)}, completed · include on Finish" ${r.checked ? "checked" : ""}></label></td>
  </tr>`;
}
function advancedFields(s, e, slot) {
  const r = D.row(store, s, e, slot, today()),
    alternate = effortField(e) === "rpe" ? "rir" : "rpe",
    run = e.kind === "run",
    distance = !run && e.prescription.includes("yd");
  return `<div data-slot="${slot.key}" data-e="${esc(e.id)}" class="advanced-fields"><div class="fields two">
    ${field(alternate, `Actual ${alternate.toUpperCase()} (optional)`, r[alternate], "number", `min="${alternate === "rpe" ? 1 : 0}" max="10" step="0.5"`)}
    ${field("date", "Performed date", r.date, "date", "required")}
    ${field("rpeLow", "Actual RPE range · low", r.rpeLow, "number", 'min="1" max="10" step="0.5"')}
    ${field("rpeHigh", "Actual RPE range · high", r.rpeHigh, "number", 'min="1" max="10" step="0.5"')}
    ${!run ? field("seconds", "Time (seconds)", r.seconds, "number", 'min="0"') + (distance ? field("reps", "Reps", r.reps, "number", 'min="0" step="1"') : field("distance", "Distance (yd)", r.distance, "number", 'min="0"')) : ""}
    ${
      !run
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
                `<option ${v === r.unit ? "selected" : ""}>${esc(v)}</option>`,
            )
            .join("")}</select></label>`
        : ""
    }
    </div><p class="hint">Use one actual RPE or a range; leave effort blank if unknown. Effort edits propagate only within this side and top/back-off group.</p>
    ${field("variant", "Actual variant (different variants stay separate)", r.variant, "text", "required")}
    ${e.device ? field("deviceMode", "Device mode / firmware (as displayed)", r.deviceMode, "text") : ""}
    <label>Notes / quality / reason skipped<textarea name="notes">${esc(r.notes)}</textarea></label></div>`;
}
function backoffText(s, e) {
  const slot = M.setSlots(e)[0],
    v = D.row(store, s, e, slot, today());
  const range =
    v.checked &&
    v.variant === e.exerciseId &&
    v.unit === e.loadUnit &&
    C.backoff(Number(v.load), e, increment(e));
  const isDraft = !!store.drafts?.[s.id]?.sets[setId(s, e, slot)];
  return range
    ? `${range.join("–")} lb from ${isDraft ? "entered top set (draft)" : "saved top set"} (${v.load} lb)`
    : `Pending actual top set · ${e.top.backPercent.join("–")}% of actual top weight`;
}
function renderInPlace() {
  const y = window.scrollY;
  const selected = [...document.querySelectorAll(".exercise")].map((card) => [
    card.dataset.exercise,
    card.querySelector(".advanced-slot").value,
  ]);
  const open = [...document.querySelectorAll("details")].map((d) => d.open);
  render();
  document.querySelectorAll("details").forEach((d, i) => {
    if (i < open.length) d.open = open[i];
  });
  for (const [id, key] of selected) {
    const card = document.querySelector(
      `.exercise[data-exercise="${CSS.escape(id)}"]`,
    );
    if (!card) continue;
    const s = session(),
      e = s.exercises.find((e) => e.id === id),
      slot = M.setSlots(e).find((slot) => slot.key === key);
    if (slot) {
      card.querySelector(".advanced-slot").value = key;
      card.querySelector(".advanced-editor").innerHTML = advancedFields(
        s,
        e,
        slot,
      );
    }
  }
  requestAnimationFrame(() => window.scrollTo(0, y));
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
  $("#undoDraft")?.addEventListener("click", () =>
    guard(() => {
      save(D.undoDraft(store, session()));
      renderInPlace();
      notify("Draft edit undone. Finalized records are unchanged.");
    }),
  );
  $("#completeSession")?.addEventListener("click", () =>
    guard(() => {
      const s = session();
      save(
        D.finishWorkout(
          store,
          program,
          s,
          today(),
          C.activeReference(store, athlete, program.paceDefaults),
        ),
      );
      renderInPlace();
      notify(
        "Workout finished. Checked results saved; prior versions retained.",
      );
    }),
  );
  document.querySelectorAll(".exercise").forEach((card) => {
    card.querySelector(".advanced-slot").onchange = (event) => {
      const s = session(),
        e = s.exercises.find((e) => e.id === card.dataset.exercise),
        slot = M.setSlots(e).find((slot) => slot.key === event.target.value);
      card.querySelector(".advanced-editor").innerHTML = advancedFields(
        s,
        e,
        slot,
      );
    };
    card.oninput = (event) =>
      guard(() => {
        const input = event.target;
        const form = input.closest("[data-slot]");
        if (!input.name || !form) return;
        const s = session(),
          e = s.exercises.find((e) => e.id === form.dataset.e),
          slot = M.setSlots(e).find((slot) => slot.key === form.dataset.slot);
        try {
          save(
            D.editDraft(
              store,
              program,
              s,
              e,
              slot,
              input.name,
              input.type === "checkbox" ? input.checked : input.value,
              today(),
            ),
          );
        } catch (err) {
          $("#draftStatus").textContent =
            "Draft NOT saved. Keep this page open and copy your input before reloading.";
          throw err;
        }
        // Patch values without replacing the focused input or closing details.
        form
          .closest(".exercise")
          .querySelectorAll("[data-slot]")
          .forEach((target) => {
            const targetSlot = M.setSlots(e).find(
                (x) => x.key === target.dataset.slot,
              ),
              values = D.row(store, s, e, targetSlot, today());
            target.querySelectorAll("[name]").forEach((control) => {
              if (control === input) return;
              if (control.type === "checkbox")
                control.checked = values[control.name];
              else control.value = values[control.name] ?? "";
            });
          });
        const backoff = form
          .closest(".exercise")
          .querySelector(".backoff-target");
        if (backoff) backoff.textContent = backoffText(s, e);
        $("#undoDraft").disabled = !store.drafts?.[s.id]?.undo.length;
        $("#draftStatus").textContent =
          "Draft saved on this browser. Finalize checked results with Finish Workout.";
      });
  });
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
  const aligned = M.adoptPaceRevision(store, program.paceDefaults);
  if (aligned !== store) save(aligned);
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
