import { compactBrowser } from "./compact-browser.js";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { applyChangeRequest } from "../src/program-changes.js";
const base = process.env.FFW_URL || "http://127.0.0.1:8000";
const program = JSON.parse(await fs.readFile("data/program.json", "utf8"));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await fs.mkdir("docs/screenshots", { recursive: true });
const shot = async (name) => {
  await page.locator("#notice").evaluate((e) => (e.textContent = ""));
  await page.screenshot({
    path: `docs/screenshots/${name}.png`,
    fullPage: false,
  });
};
async function advanced(row) {
  const card = row.locator(
    'xpath=ancestor::section[contains(@class,"exercise")]',
  );
  await card.locator(".exercise-details").evaluate((e) => (e.open = true));
  await card
    .locator(".advanced-slot")
    .selectOption({ value: await row.getAttribute("data-slot") });
  return card.locator(".advanced-fields");
}
// Leave other finalized results intact; unchecked unfinalized rows are explicit skips.
async function finishOnly(form) {
  await page.locator(".set-row").evaluateAll(
    (forms, target) => {
      for (const f of forms) {
        if (f.dataset.e === target.e && f.dataset.slot === target.slot)
          continue;
        const check = f.querySelector('[name="checked"]');
        if (check.checked && f.dataset.finalized !== "true") {
          check.checked = false;
          check.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    },
    await form.evaluate((f) => ({ e: f.dataset.e, slot: f.dataset.slot })),
  );
  await form.locator('[name="checked"]').check();
  await page.locator("#completeSession").click();
  assert.match(await page.locator("#notice").innerText(), /Workout finished/);
}
try {
  await page.goto(base);
  await page.waitForSelector(".exercise");
  assert.equal(await page.title(), "FlyFightWin · Training");
  await shot("mobile-today");
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const accessibility = await page.evaluate(
    async () =>
      await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
  );
  assert.deepEqual(
    accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
    [],
  );
  console.log("PASS axe WCAG A/AA audit on mobile workout");
  // Ranged reps now prefill their minimum. Explicitly clearing a checked
  // required row must still block Finish without committing history.
  const firstBenchRep = page.locator('[data-exercise="c1-incline-dumbbell-bench"] .set-row [name="reps"]').first();
  assert.equal(await firstBenchRep.inputValue(), "8");
  await firstBenchRep.fill("");
  await page.locator("#completeSession").click();
  assert.match(
    await page.locator("#notice").innerText(),
    /Record reps, time or distance/,
  );
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem("flyfightwin.log.v3")))).records.length, 0);
  await firstBenchRep.fill("8");
  // Exercise every active session for both athletes and save a synthetic working set.
  let rendered = 0;
  for (const a of ["z", "h"]) {
    await page.locator(`[data-athlete="${a}"]`).click();
    for (let w = 1; w <= 8; w++) {
      await page.selectOption("#week", String(w));
      for (const d of [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ]) {
        await page.locator(`[data-day="${d}"]`).click();
        const s = program.sessions.find(
            (s) => s.week === w && s.day === d && s.athlete === a,
          ),
          work = s.exercises.filter((e) => !e.warmup);
        assert.equal(
          await page.locator(".exercise").count(),
          work.length,
          `${s.id} exercise count`,
        );
        assert.equal(
          await page.locator(".set-row").count(),
          work.reduce((n, e) => n + e.sets * (e.unilateral ? 2 : 1), 0),
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${s.id} horizontal overflow`,
        );
        const card = page.locator(".exercise").first();
        const form = card.locator(".set-row").first();
        await form
          .locator(
            '[name="' +
              (work[0].kind === "run"
                ? "seconds"
                : work[0].prescription.includes("yd")
                  ? "distance"
                  : "reps") +
              '"]',
          )
          .fill(work[0].kind === "run" ? "300" : "4");
        await finishOnly(form);
        assert.equal(
          await card.locator(".set-row").first().getAttribute("data-finalized"),
          "true",
          s.id,
        );
        if (
          a === "z" &&
          [4, 8].includes(w) &&
          ["Monday", "Wednesday", "Friday"].includes(d)
        ) {
          await page.evaluate(() => scrollTo(0, 0));
          await shot(`mobile-week${w}-${d.toLowerCase()}`);
        }
        rendered++;
      }
    }
  }
  console.log(
    `PASS ${rendered} active sessions render and save; every working-set editor present; no mobile overflow`,
  );
  await page.locator('[data-athlete="z"]').click();
  await page.selectOption("#week", "1");
  await page.locator('[data-day="Monday"]').click();
  const main = page
    .locator(".exercise")
    .filter({ has: page.locator("h2", { hasText: "Barbell Z press" }) });
  const top = main.locator(".set-row").first();
  await top.locator('[name="load"]').fill("100");
  await top.locator('[name="reps"]').fill("5");
  await (await advanced(top)).locator('[name="date"]').fill("2026-01-05");
  await finishOnly(top);
  assert.match(await main.innerText(), /90–90 lb from saved top set/);
  await page.reload();
  await page.waitForSelector(".exercise");
  assert.match(await main.innerText(), /90–90 lb from saved top set/);
  await main.evaluate((e) =>
    scrollTo(0, e.getBoundingClientRect().top + scrollY - 16),
  );
  await shot("mobile-main-lift");
  const accessory = page.locator('[data-exercise="c1-incline-dumbbell-bench"]');
  await accessory.evaluate((e) =>
    scrollTo(0, e.getBoundingClientRect().top + scrollY - 16),
  );
  await shot("mobile-accessory");
  await page.locator('[data-view="Plan"]').click();
  await page.locator("#startDate").fill("2026-01-05");
  await page.locator("#startDate").dispatchEvent("change");
  assert.equal(await page.locator(".plan-grid button").count(), 7);
  await page.evaluate(() => scrollTo(0, 0));
  await shot("mobile-plan");
  await page.locator('[data-view="Today"]').click();
  await page.selectOption("#week", "2");
  await top.locator('[name="load"]').fill("105");
  await top.locator('[name="reps"]').fill("5");
  await (await advanced(top)).locator('[name="date"]').fill("2026-01-12");
  await finishOnly(top);
  await page.selectOption("#week", "1");
  await page.locator('[data-view="Progress"]').click();
  await page.evaluate(() => scrollTo(0, 0));
  await shot("mobile-progress");
  await page.locator('[data-view="History"]').click();
  await page.evaluate(() => scrollTo(0, 0));
  await shot("mobile-history");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  const path = await download.path();
  const exported = JSON.parse(await fs.readFile(path, "utf8"));
  assert.equal(exported.schema, 3);
  assert.equal(
    exported.records.filter((r) => r.type === "set" && r.status === "done")
      .length,
    98,
  );
  await page.locator("#importFile").setInputFiles({
    name: "synthetic-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.waitForSelector("#importDialog[open]");
  assert.match(
    await page.locator("#importPreview").innerText(),
    /0 new records/,
  );
  await page.locator("#confirmImport").click();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("flyfightwin.log.v3")).records.length,
    ),
    exported.records.length,
  );
  await page.locator("#importFile").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#importDialog[open]").count(), 0);
  console.log(
    "PASS top/backoff, reload persistence, plan, export/import roundtrip and malformed JSON protection",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-view="Today"]').click();
  await page.evaluate(() => scrollTo(0, 0));
  await shot("desktop-today");
  await page.locator('[data-view="Progress"]').click();
  await page.evaluate(() => scrollTo(0, 0));
  await shot("desktop-progress");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator('[data-view="Today"]').click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  console.log("PASS desktop 1440 and narrow mobile 320 layouts");
  // A published data-only change must preserve started/completed sessions.
  await page.locator('[data-athlete="h"]').click();
  await page.locator('[data-day="Thursday"]').click();
  await page.locator("#completeSession").click();
  const beforeUpdate = await page.evaluate(() =>
    localStorage.getItem("flyfightwin.log.v3"),
  );
  const target = program.sessions.find(
    (s) => s.athlete === "h" && s.week === 1 && s.day === "Monday",
  );
  const revised = applyChangeRequest(program, {
    schema: "flyfightwin.program-change.v1",
    id: "browser-synthetic",
    approved: true,
    approvalReference: "Synthetic test only",
    baseProgramId: program.id,
    nextProgramId: "athletic-strength-8-v2",
    nextVersion: 2,
    changes: [
      {
        scope: "exercise",
        athlete: "h",
        week: 1,
        day: "Monday",
        exerciseId: target.exercises.find((e) => e.group === "C1").id,
        patch: { prescription: "6-8 reps", repRange: [6, 8] },
      },
    ],
  });
  await page.route("**/data/program.json", (route) =>
    route.fulfill({ json: revised }),
  );
  await page.reload();
  await page.waitForSelector(".exercise");
  await page.locator('[data-athlete="h"]').click();
  assert.equal(
    await page
      .locator('[data-exercise="c1-incline-dumbbell-bench"] .prescription')
      .innerText(),
    "3 × 8-10 reps",
  );
  assert.match(
    await page.locator(".workout-head").innerText(),
    /earlier program revision/,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("flyfightwin.log.v3")),
    beforeUpdate,
  );
  const clean = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    future = await clean.newPage();
  await future.route("**/data/program.json", (route) =>
    route.fulfill({ json: revised }),
  );
  await future.goto(base);
  await future.waitForSelector(".exercise");
  await future.locator('[data-athlete="h"]').click();
  assert.equal(
    await future
      .locator('[data-exercise="c1-incline-dumbbell-bench"] .prescription')
      .innerText(),
    "3 × 6-8 reps",
  );
  await clean.close();
  console.log(
    "PASS data-only program revision: saved sessions/performance unchanged; unstarted session receives targeted update",
  );
  // RTS form regression uses synthetic values and preserves immutable revisions.
  await page.unroute("**/data/program.json");
  await page.reload();
  await page.waitForSelector(".exercise");
  const rtsForm = page
    .locator('[data-exercise="b-barbell-z-press"] .set-row')
    .first();
  await rtsForm.locator('[name="load"]').fill("125");
  await rtsForm.locator('[name="reps"]').fill("5");
  await rtsForm.locator('[name="rpe"]').fill("7.5");
  await (await advanced(rtsForm)).locator('[name="date"]').fill("2026-01-19");
  await finishOnly(rtsForm);
  assert.match(
    await page
      .locator('[data-exercise="b-barbell-z-press"] .loading-explanation')
      .textContent(),
    /RTS:/,
  );
  await rtsForm.locator('[name="rpe"]').fill("");
  await (await advanced(rtsForm)).locator('[name="rpeLow"]').fill("7");
  await (await advanced(rtsForm)).locator('[name="rpeHigh"]').fill("8");
  await finishOnly(rtsForm);
  await page.reload();
  await page.waitForSelector(".exercise");
  assert.match(
    await page
      .locator('[data-exercise="b-barbell-z-press"] .loading-explanation')
      .textContent(),
    /actual RPE 7–8/,
  );
  console.log("PASS RTS half-point effort and uncertainty range save/reload");
  await compactBrowser(browser, base);
  // Isolated first-run migration and archive read-only behavior.
  const privatePage = await context.newPage();
  await privatePage.goto(base);
  await privatePage.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "blueline.log.v2",
      JSON.stringify({
        v: 2,
        z: { tt: { 4: { s: 500, v: 38 } } },
        h: { pt: { 4: { pu: 18, su: 22 } } },
      }),
    );
    localStorage.setItem("blueline3", '{"wk":7,"day":"WED"}');
  });
  await privatePage.reload();
  await privatePage.waitForSelector(".exercise");
  assert.equal(
    await privatePage.evaluate(
      () =>
        JSON.parse(localStorage.getItem("flyfightwin.log.v3")).records.length,
    ),
    2,
  );
  const original = await privatePage.evaluate(() =>
    localStorage.getItem("blueline.log.v2"),
  );
  await privatePage.goto(`${base}/legacy.html`);
  await privatePage.locator("#wkBtns button").nth(2).click();
  assert.equal(
    await privatePage.evaluate(() =>
      window.localStorage.getItem("blueline.log.v2"),
    ),
    original,
  );
  assert.equal(
    await privatePage.evaluate(() => window.localStorage.getItem("blueline3")),
    '{"wk":7,"day":"WED"}',
  );
  // A browser pinned to a historical mile value must adopt the newly approved
  // two-mile baseline exactly once, without rewriting any training records.
  // Seed the real origin, not the legacy.html read-only storage adapter.
  await privatePage.goto(base);
  await privatePage.waitForSelector(".exercise");
  await privatePage.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("flyfightwin.log.v3"));
    d.settings["pace:z"] = "legacy:z:tt:4";
    delete d.settings["pace:z:referenceRevision"];
    delete d.settings["pace:z:previousChoice"];
    localStorage.setItem("flyfightwin.log.v3", JSON.stringify(d));
  });
  await privatePage.goto(base);
  await privatePage.waitForSelector(".exercise");
  await privatePage.locator('[data-view="Progress"]').click();
  const adopted = await privatePage.evaluate(() =>
    JSON.parse(localStorage.getItem("flyfightwin.log.v3")),
  );
  assert.equal(adopted.settings["pace:z"], "program");
  assert.equal(adopted.settings["pace:z:previousChoice"], "legacy:z:tt:4");
  assert.ok(adopted.settings["pace:z:referenceRevision"]);
  assert.equal(adopted.records.length, 2);
  assert.match(await privatePage.locator(".stats").innerText(), /44\.8/);
  assert.equal(
    await privatePage.evaluate(() => localStorage.getItem("blueline.log.v2")),
    original,
  );
  await privatePage.locator("#paceReference").selectOption("legacy:z:tt:4");
  await privatePage.reload();
  await privatePage.locator('[data-view="Progress"]').click();
  assert.match(await privatePage.locator(".stats").innerText(), /38\.0/);
  await privatePage.close();
  console.log("PASS updated two-mile pace adoption, future manual override and legacy-key preservation");
  // Saved Tuesday performances can retain a historical VDOT, but the live
  // workout targets must use the CURRENT athlete reference in all eight weeks.
  const paceContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pacePage = await paceContext.newPage();
  await pacePage.goto(base);
  await pacePage.waitForSelector(".exercise");
  await pacePage.evaluate((master) => {
    const d = JSON.parse(localStorage.getItem("flyfightwin.log.v3"));
    d.settings["pace:z"] = "program";
    for (const session of master.sessions.filter((s) => s.athlete === "z" && s.day === "Tuesday")) {
      const work = session.exercises.find((e) => e.kind === "run" && !e.warmup);
      const snapshot = structuredClone(session);
      if (session.week <= 2) snapshot.exercises.find((e) => e.id === work.id).intensity = "T (VDOT 47.2)";
      d.records.push({
        id: `set:${session.id}:${work.id}:0`,
        type: "set", athlete: "z", sessionId: session.id,
        exerciseId: work.exerciseId, variant: work.exerciseId,
        slot: 0, side: "", unit: "running", distanceUnit: "mi",
        status: "done", seconds: 300, date: "2026-11-01",
        paceReference: { value: 47.2, source: "historical logged pace" },
      });
      if (session.week <= 2) d.records.push({
        id: `session:${session.id}`, type: "session", athlete: "z",
        sessionId: session.id, status: "started", date: "2026-11-01",
        programVersion: master.id, blockId: master.blockId,
        prescriptionSnapshot: snapshot,
      });
    }
    localStorage.setItem("flyfightwin.log.v3", JSON.stringify(d));
  }, program);
  const originalPaceRecords = await pacePage.evaluate(() =>
    JSON.parse(localStorage.getItem("flyfightwin.log.v3")).records
  );
  await pacePage.reload();
  await pacePage.waitForSelector(".exercise");
  for (let w = 1; w <= 8; w++) {
    await pacePage.selectOption("#week", String(w));
    await pacePage.locator('[data-day="Tuesday"]').click();
    const card = pacePage.locator("section.card").filter({ hasText: "Active pace reference" });
    assert.equal(await card.locator("h2").innerText(), "VDOT 44.8", `week ${w}`);
    assert.doesNotMatch(await pacePage.locator("#content").innerText(), /VDOT 47\.2/, `week ${w}`);
    const paces = await pacePage.locator(".compact-target").allInnerTexts();
    assert.ok(paces.length > 0, `week ${w} has live running paces`);
  }
  assert.deepEqual(
    await pacePage.evaluate(() => JSON.parse(localStorage.getItem("flyfightwin.log.v3")).records),
    originalPaceRecords
  );
  await pacePage.locator('[data-athlete="h"]').click();
  assert.match(await pacePage.locator("#content").innerText(), /Baseline pending/);
  await paceContext.close();
  console.log("PASS current 44.8 VDOT on all Zack Tuesdays despite historical 47.2 snapshots; records and Hannah unchanged");
  assert.deepEqual(errors, []);
  console.log("PASS no application JavaScript errors");
} finally {
  await browser.close();
}
