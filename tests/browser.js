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
  await page.locator("#completeSession").click();
  assert.match(await page.locator("#notice").innerText(), /every required/);
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
          await page.locator(".set-form").count(),
          work.reduce((n, e) => n + e.sets * (e.unilateral ? 2 : 1), 0),
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${s.id} horizontal overflow`,
        );
        const card = page.locator(".exercise").first(),
          log = card.locator("details.log");
        await log.evaluate((e) => (e.open = true));
        const form = card.locator(".set-form").first();
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
        await form.locator('button[value="done"]').click();
        assert.match(
          await card.locator(".set-head").first().innerText(),
          /saved/,
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
  const top = main.locator(".set-form").first();
  await top.locator('[name="load"]').fill("100");
  await top.locator('[name="reps"]').fill("5");
  await top.locator("details").evaluate((e) => (e.open = true));
  await top.locator('[name="date"]').fill("2026-01-05");
  await top.locator('button[value="done"]').click();
  assert.match(await main.innerText(), /90–90 lb from saved top set/);
  await page.reload();
  await page.waitForSelector(".exercise");
  assert.match(await main.innerText(), /90–90 lb from saved top set/);
  await main.evaluate((e) =>
    scrollTo(0, e.getBoundingClientRect().top + scrollY - 16),
  );
  await shot("mobile-main-lift");
  const accessory = page.locator('[data-exercise="c1-incline-dumbbell-bench"]');
  await accessory.locator("details.log").evaluate((e) => (e.open = true));
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
  await top.locator("details").evaluate((e) => (e.open = true));
  await top.locator('[name="date"]').fill("2026-01-12");
  await top.locator('button[value="done"]').click();
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
  assert.equal(exported.records.filter((r) => r.type === "set").length, 98);
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
  await privatePage.close();
  console.log("PASS legacy auto-migration and archive protects original keys");
  assert.deepEqual(errors, []);
  console.log("PASS no application JavaScript errors");
} finally {
  await browser.close();
}
