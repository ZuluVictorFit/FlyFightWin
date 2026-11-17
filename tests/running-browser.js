import assert from "node:assert/strict";
import fs from "node:fs/promises";
import * as C from "../src/calculations.js";
export async function runningBrowser(browser, base, program) {
  const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }),
    page = await ctx.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const data = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("flyfightwin.log.v3")));
  const select = async (a, w, day) => {
    await page.locator('[data-view="Today"]').click();
    await page.locator(`[data-athlete="${a}"]`).click();
    await page.selectOption("#week", String(w));
    await page.locator(`[data-day="${day}"]`).click();
  };
  const finish = async () => {
    await page.locator("#completeSession").click();
    assert.match(await page.locator("#notice").innerText(), /Workout finished/);
  };
  const card = page.locator('[data-exercise="work-cruise-tempo-run"]');
  const row = (i) => card.locator(".set-row").nth(i);
  const values = (name) =>
    card
      .locator(`.set-row [name="${name}"]`)
      .evaluateAll((xs) => xs.map((x) => x.value));
  try {
    await page.goto(base);
    await page.waitForSelector(".exercise");
    await select("z", 1, "Tuesday");
    assert.equal(await card.locator("table").count(), 1);
    assert.equal(await card.locator("form").count(), 0);
    assert.equal(await card.locator("details").count(), 1);
    assert.deepEqual(await card.locator("thead th").allTextContents(), [
      "Set",
      "Distance",
      "Avg Pace/mi",
      "HRbpm",
      "✓Completed",
    ]);
    assert.match(
      await card.innerText(),
      /Prescribed work 5:00 · Recovery 1:15 easy jog/,
    );
    for (const name of ["distance", "pace", "averageHr"])
      assert.deepEqual(await values(name), ["", "", ""]);
    await row(0).locator('[name="distance"]').fill("0.66");
    await row(0).locator('[name="pace"]').fill("7:29");
    await row(0).locator('[name="averageHr"]').fill("160");
    assert.deepEqual(await values("distance"), ["0.66", "0.66", "0.66"]);
    assert.deepEqual(await values("pace"), ["7:29", "7:29", "7:29"]);
    assert.deepEqual(await values("averageHr"), ["160", "", ""]);
    await row(1).locator('[name="distance"]').fill("0.67");
    await row(1).locator('[name="pace"]').fill("7:27");
    await row(1).locator('[name="averageHr"]').fill("162");
    assert.deepEqual(await values("distance"), ["0.66", "0.67", "0.67"]);
    assert.deepEqual(await values("pace"), ["7:29", "7:27", "7:27"]);
    assert.deepEqual(await values("averageHr"), ["160", "162", ""]);
    await row(2).locator('[name="distance"]').fill("0.68");
    await row(2).locator('[name="pace"]').fill("7:20");
    await row(2).locator('[name="averageHr"]').fill("164");
    assert.equal((await data()).records.length, 0);
    await page.reload();
    await page.waitForSelector(".exercise");
    await select("z", 1, "Tuesday");
    assert.deepEqual(await values("averageHr"), ["160", "162", "164"]);
    await page.locator("#undoDraft").click();
    assert.deepEqual(await values("averageHr"), ["160", "162", ""]);
    await row(2).locator('[name="averageHr"]').fill("164");
    // Invalid partial Watch input stays in drafts and cannot partly finalize a workout.
    await row(1).locator('[name="pace"]').fill("7:99");
    await page.locator("#completeSession").click();
    assert.match(await page.locator("#notice").innerText(), /average pace/);
    assert.equal((await data()).records.length, 0);
    await page.locator("#undoDraft").click();
    assert.deepEqual(await values("pace"), ["7:29", "7:27", "7:20"]);
    const draftBackup = await data();
    await finish();
    const original = (await data()).records;
    assert.deepEqual(
      original
        .filter((r) => r.type === "set")
        .map((r) => [
          r.distance,
          r.averagePaceSecondsPerMile,
          r.averageHr,
          r.seconds,
        ]),
      [
        [0.66, 449, 160, null],
        [0.67, 447, 162, null],
        [0.68, 440, 164, null],
      ],
    );
    assert.equal(
      C.activeReference(await data(), "z", program.paceDefaults).value,
      program.paceDefaults.z.value,
    );
    await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
    assert.deepEqual(
      await page.evaluate(async () =>
        (
          await axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          })
        ).violations.map((v) => v.id),
      ),
      [],
    );
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 740 });
      await card.evaluate((e) =>
        scrollTo(0, e.getBoundingClientRect().top + scrollY - 12),
      );
      await page.locator("#notice").evaluate((e) => (e.textContent = ""));
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.ok(
        await card
          .locator(".set-row")
          .evaluateAll((rs) =>
            rs.every(
              (r) =>
                r.getBoundingClientRect().height >= 44 &&
                r.getBoundingClientRect().height <= 48,
            ),
          ),
      );
      await page.screenshot({
        path: `docs/screenshots/mobile-watch-intervals-${width}.png`,
      });
    }
    await row(1).locator('[name="pace"]').fill("7:25");
    assert.deepEqual(await values("pace"), ["7:29", "7:25", "7:20"]);
    assert.deepEqual((await data()).records, original);
    await finish();
    assert.ok(
      (await data()).revisions.some(
        (v) => v.record.averagePaceSecondsPerMile === 447,
      ),
    );
    await page.locator('[data-view="History"]').click();
    assert.match(
      await page.locator("#content").innerText(),
      /7:29\/mi · 160 bpm/,
    );
    const wait = page.waitForEvent("download");
    await page.locator("#export").click();
    const backup = await fs.readFile(await (await wait).path());
    // Restore actual results, then pending drafts in a separate browser using the real UI.
    const restored = await browser.newContext(),
      rp = await restored.newPage();
    await rp.goto(base);
    await rp.waitForSelector(".exercise");
    await rp.locator('[data-view="History"]').click();
    await rp.locator("#importAthlete").selectOption("h");
    await rp
      .locator("#importFile")
      .setInputFiles({
        name: "synthetic-watch.json",
        mimeType: "application/json",
        buffer: backup,
      });
    await rp.locator("#confirmImport").click();
    assert.equal(
      await rp.evaluate(
        () =>
          JSON.parse(localStorage.getItem("flyfightwin.log.v3")).records.length,
      ),
      0,
    );
    await rp.locator("#importAthlete").selectOption("z");
    await rp
      .locator("#importFile")
      .setInputFiles({
        name: "synthetic-watch.json",
        mimeType: "application/json",
        buffer: backup,
      });
    await rp.locator("#confirmImport").click();
    assert.deepEqual(
      await rp.evaluate(
        () => JSON.parse(localStorage.getItem("flyfightwin.log.v3")).records,
      ),
      (await data()).records,
    );
    await restored.close();
    const dc = await browser.newContext(),
      dp = await dc.newPage();
    await dp.goto(base);
    await dp.waitForSelector(".exercise");
    await dp.locator('[data-view="History"]').click();
    await dp
      .locator("#importFile")
      .setInputFiles({
        name: "synthetic-watch-draft.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(draftBackup)),
      });
    await dp.locator("#confirmImport").click();
    await dp.locator('[data-view="Today"]').click();
    await dp.locator('[data-day="Tuesday"]').click();
    assert.deepEqual(
      await dp
        .locator('.set-row [name="pace"]')
        .evaluateAll((xs) => xs.map((x) => x.value)),
      ["7:29", "7:27", "7:20"],
    );
    await dc.close();
    // Distance intervals retain editable meters and independent actual elapsed time.
    await select("z", 7, "Tuesday");
    const meter = page.locator(
      '[data-exercise="work-interval-repetition-run"]',
    );
    assert.match(await meter.locator(".prescription").innerText(), /800 m/);
    assert.deepEqual(await meter.locator(".distance-unit").allTextContents(), [
      "m",
      "m",
      "m",
    ]);
    await meter.locator('.set-row [name="distance"]').first().fill("800");
    await meter.locator('.set-row [name="pace"]').first().fill("7:15");
    await meter.locator(".exercise-details").evaluate((e) => (e.open = true));
    await meter.locator('[name="elapsedTime"]').fill("3:34");
    await meter.locator(".advanced-slot").selectOption({ value: "1" });
    assert.equal(await meter.locator('[name="elapsedTime"]').inputValue(), "");
    await meter.locator('[name="distanceUnit"]').selectOption("mi");
    await meter.locator('.set-row [name="distance"]').nth(1).fill(".50");
    assert.deepEqual(
      await meter
        .locator('.set-row [name="distance"]')
        .evaluateAll((xs) => xs.map((x) => x.value)),
      ["800", ".50", "800"],
    );
    assert.deepEqual(await meter.locator(".distance-unit").allTextContents(), [
      "m",
      "mi",
      "m",
    ]);
    await finish();
    const ms = (await data()).records.filter(
      (r) => r.type === "set" && r.sessionId.includes("w7-tuesday"),
    );
    assert.deepEqual(
      ms.map((r) => r.seconds),
      [214, null, null],
    );
    assert.deepEqual(
      ms.map((r) => r.averageHr),
      [null, null, null],
    );
    // Trial time remains directly visible; ordinary interval pace/HR cannot supply it.
    await select("h", 1, "Tuesday");
    const trial = page.locator('[data-exercise="work-2-mile-time-trial"]');
    assert.equal(await trial.locator(".trial-finish input").isVisible(), true);
    await trial.locator('.set-row [name="distance"]').fill("2");
    await trial.locator('[name="pace"]').fill("7:29");
    await page.locator("#completeSession").click();
    assert.match(
      await page.locator("#notice").innerText(),
      /actual two-mile finishing time/,
    );
    await trial.locator(".trial-finish input").fill("14:58");
    await finish();
    assert.equal(
      C.runReferences(await data(), "h")[0].value,
      C.vdot(3218.69, 898),
    );
    assert.equal(
      C.activeReference(await data(), "z", program.paceDefaults).value,
      program.paceDefaults.z.value,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS Watch example, independent distance/pace/HR, invalid input, reload/Undo/Finish/corrections, UI backup restore, scoped imports, meter intervals, trial time/VDOT, axe and 48px rows at 320/390",
    );
  } finally {
    await ctx.close();
  }
  // Exercise every running session for both athletes with synthetic measured inputs.
  const sweep = await browser.newContext({
      viewport: { width: 320, height: 740 },
      isMobile: true,
      hasTouch: true,
    }),
    sp = await sweep.newPage();
  try {
    await sp.goto(base);
    await sp.waitForSelector(".exercise");
    let count = 0;
    for (const s of program.sessions.filter((s) =>
      s.exercises.some((e) => e.kind === "run" && !e.warmup),
    )) {
      await sp.locator(`[data-athlete="${s.athlete}"]`).click();
      await sp.selectOption("#week", String(s.week));
      await sp.locator(`[data-day="${s.day}"]`).click();
      const work = s.exercises.filter((e) => !e.warmup),
        e = work[0],
        c = sp.locator(`[data-exercise="${e.id}"]`);
      assert.ok(
        await sp.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.equal(
        await sp.locator(".set-row").count(),
        work.reduce((n, e) => n + e.sets, 0),
      );
      await c
        .locator('.set-row [name="distance"]')
        .first()
        .fill(
          /\bm\b/.test(e.prescription)
            ? "800"
            : e.exerciseId === "2-mile-time-trial"
              ? "2"
              : "1",
        );
      await c.locator('.set-row [name="pace"]').first().fill("8:00");
      await c.locator('.set-row [name="averageHr"]').first().fill("145");
      if (e.exerciseId === "2-mile-time-trial")
        await c.locator(".trial-finish input").fill("16:00");
      for (const extra of work.slice(1))
        for (const check of await sp
          .locator(`[data-exercise="${extra.id}"] .set-row [name="checked"]`)
          .all())
          await check.uncheck();
      await sp.locator("#completeSession").click();
      assert.match(await sp.locator("#notice").innerText(), /Workout finished/);
      const records = await sp.evaluate(
        (id) =>
          JSON.parse(localStorage.getItem("flyfightwin.log.v3")).records.filter(
            (r) => r.type === "set" && r.sessionId === id,
          ),
        s.id,
      );
      assert.equal(records.filter((r) => r.status === "done").length, e.sets);
      assert.equal(records.filter((r) => r.averageHr === 145).length, 1);
      assert.ok(records.every((r) => !r.prescriptionSnapshot.warmup));
      count++;
    }
    assert.equal(count, 48);
    console.log(
      "PASS all 48 running sessions across both athletes/eight weeks, optional extra work and preparations preserved, no 320px overflow",
    );
  } finally {
    await sweep.close();
  }
}
