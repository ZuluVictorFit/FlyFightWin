import assert from "node:assert/strict";
import fs from "node:fs/promises";

export async function compactBrowser(browser, base) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const store = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("flyfightwin.log.v3")));
  const bench = page.locator('[data-exercise="c1-incline-dumbbell-bench"]');
  const form = (i) => bench.locator(".set-row").nth(i);
  const values = (field) =>
    bench
      .locator(`.set-table [name="${field}"]`)
      .evaluateAll((inputs) => inputs.map((i) => i.value));
  try {
    await page.goto(base);
    await page.waitForSelector(".exercise");
    assert.equal(await page.locator(".exercise form").count(), 0);
    assert.equal(await bench.locator("table").count(), 1);
    assert.equal(await bench.locator("details").count(), 1);
    assert.equal(await bench.locator(".set-row").count(), 3);
    const geometry = await bench.evaluate((e) => ({
      height: e.querySelector(".logging-area").getBoundingClientRect().height,
      rows: [...e.querySelectorAll(".set-row")].map(
        (r) => r.getBoundingClientRect().height,
      ),
    }));
    assert.ok(
      geometry.height >= 200 && geometry.height <= 250,
      JSON.stringify(geometry),
    );
    assert.ok(
      geometry.rows.every((h) => h >= 44 && h <= 48),
      JSON.stringify(geometry),
    );
    assert.equal(await page.locator(".set-row button").count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "Finish Workout", exact: true })
        .count(),
      1,
    );
    assert.ok(
      await page
        .locator('[data-exercise="d1-barbell-bent-over-row"] [name="reps"]')
        .evaluateAll((xs) => xs.every((x) => x.value === "8")),
    );
    // Range-based prescriptions prefill their lower bound as editable draft values.
    assert.deepEqual(await values("reps"), ["8", "8", "8"]);
    assert.equal((await store()).records.length, 0);
    assert.ok(
      await page
        .locator('.set-row [name="checked"]')
        .evaluateAll((xs) => xs.every((x) => x.checked)),
    );
    await form(0).locator('[name="reps"]').fill("8");
    await form(0).locator('[name="load"]').fill("80");
    assert.deepEqual(await values("load"), ["80", "80", "80"]);
    await form(1).locator('[name="load"]').fill("70");
    assert.deepEqual(await values("load"), ["80", "70", "70"]);
    assert.deepEqual(await values("reps"), ["8", "8", "8"]);
    await form(1).locator('[name="reps"]').fill("6");
    assert.deepEqual(await values("load"), ["80", "70", "70"]);
    assert.deepEqual(await values("reps"), ["8", "6", "6"]);
    await form(1).locator('[name="rir"]').fill("2");
    assert.deepEqual(await values("rir"), ["", "2", "2"]);
    assert.deepEqual(await values("rpe"), []);
    assert.equal((await store()).records.length, 0);
    await page.reload();
    await page.waitForSelector(".exercise");
    assert.deepEqual(await values("load"), ["80", "70", "70"]);
    await page.locator("#undoDraft").click();
    assert.deepEqual(await values("rir"), ["", "", ""]);
    assert.deepEqual(await values("reps"), ["8", "6", "6"]);
    await page.locator("#undoDraft").click();
    assert.deepEqual(await values("reps"), ["8", "8", "8"]);
    await form(1).locator('[name="reps"]').fill("6");
    await form(2).locator('[name="load"]').fill("65");
    assert.deepEqual(await values("load"), ["80", "70", "65"]);
    await page.locator("#undoDraft").click();
    assert.deepEqual(await values("load"), ["80", "70", "70"]);
    await page.locator('[data-athlete="h"]').click();
    assert.deepEqual(await values("load"), ["", "", ""]);
    await page.locator('[data-athlete="z"]').click();
    assert.deepEqual(await values("load"), ["80", "70", "70"]);

    await bench.locator(".exercise-details").evaluate((e) => (e.open = true));
    await bench.locator(".advanced-slot").selectOption({ value: "1" });
    await bench.locator('.advanced-fields [name="rpe"]').fill("7.5");
    await bench.locator(".advanced-slot").selectOption({ value: "2" });
    assert.equal(
      await bench.locator('.advanced-fields [name="rpe"]').inputValue(),
      "7.5",
    );
    await page.locator("#undoDraft").click();
    assert.equal(await bench.locator(".advanced-slot").inputValue(), "2");
    assert.equal(
      await bench.locator('.advanced-fields [name="rpe"]').inputValue(),
      "",
    );
    await bench.locator(".exercise-details").evaluate((e) => (e.open = false));
    const main = page.locator('[data-exercise="b-barbell-z-press"]');
    assert.deepEqual(
      await main
        .locator('[name="reps"]')
        .evaluateAll((xs) => xs.map((x) => x.value)),
      ["5", "6", "6", "6"],
    );
    await main.locator('[name="load"]').first().fill("125");
    await main.locator('[name="rpe"]').first().fill("7.5");
    assert.deepEqual(
      await main
        .locator('[name="load"]')
        .evaluateAll((xs) => xs.map((x) => x.value)),
      ["125", "", "", ""],
    );
    assert.deepEqual(
      await main
        .locator('[name="rpe"]')
        .evaluateAll((xs) => xs.map((x) => x.value)),
      ["7.5", "", "", ""],
    );
    assert.match(
      await main.locator(".backoff-target").innerText(),
      /110–115 lb from entered top set \(draft\)/,
    );
    await main.locator('[name="load"]').nth(1).fill("110");
    await main.locator('[name="load"]').nth(2).fill("105");
    assert.deepEqual(
      await main
        .locator('[name="load"]')
        .evaluateAll((xs) => xs.map((x) => x.value)),
      ["125", "110", "105", "105"],
    );
    const sided = page.locator('[data-exercise="a-rotational-med-ball-throw"]');
    await sided.locator('[name="load"]').first().fill("10");
    assert.deepEqual(
      await sided
        .locator('[name="load"]')
        .evaluateAll((xs) => xs.map((x) => x.value)),
      ["10", "", "10", "", "10", ""],
    );
    await sided.locator('.set-row[data-slot="1R"] [name="reps"]').fill("3");
    assert.deepEqual(
      await sided
        .locator('[name="reps"]')
        .evaluateAll((xs) => xs.map((x) => x.value)),
      ["4", "4", "4", "3", "4", "3"],
    );
    await page.locator("#completeSession").click();
    assert.match(
      await page.locator("#notice").innerText(),
      /Record reps, time or distance/,
    );
    assert.equal((await store()).records.length, 0);
    assert.ok((await store()).drafts);

    // A real backup UI round trip includes drafts without treating them as performance.
    await page.locator('[data-view="History"]').click();
    const waiting = page.waitForEvent("download");
    await page.locator("#export").click();
    const download = await waiting,
      raw = await fs.readFile(await download.path());
    const restored = await browser.newContext(),
      restorePage = await restored.newPage();
    await restorePage.goto(base);
    await restorePage.waitForSelector(".exercise");
    await restorePage.locator('[data-view="History"]').click();
    await restorePage.locator("#importFile").setInputFiles({
      name: "synthetic-draft.json",
      mimeType: "application/json",
      buffer: raw,
    });
    await restorePage.locator("#confirmImport").click();
    await restorePage.locator('[data-view="Today"]').click();
    assert.deepEqual(
      await restorePage
        .locator('[data-exercise="c1-incline-dumbbell-bench"] [name="load"]')
        .evaluateAll((xs) => xs.map((x) => x.value)),
      ["80", "70", "70"],
    );
    assert.equal(
      await restorePage.evaluate(
        () =>
          JSON.parse(localStorage.getItem("flyfightwin.log.v3")).records.length,
      ),
      0,
    );
    await restored.close();
    await page.locator('[data-view="Today"]').click();
    await page.locator(".set-row").evaluateAll((forms) => {
      for (const f of forms)
        if (f.dataset.e !== "c1-incline-dumbbell-bench") {
          const c = f.querySelector('[name="checked"]');
          c.checked = false;
          c.dispatchEvent(new Event("input", { bubbles: true }));
        }
    });
    await bench.evaluate((e) =>
      scrollTo(0, e.getBoundingClientRect().top + scrollY - 12),
    );
    await page.locator("#notice").evaluate((e) => (e.textContent = ""));
    await page.screenshot({
      path: "docs/screenshots/mobile-compact-table.png",
    });
    await page.locator("#completeSession").click();
    assert.match(await page.locator("#notice").innerText(), /Workout finished/);
    const completed = (await store()).records;
    const actual = completed.filter(
      (r) => r.type === "set" && r.status === "done",
    );
    assert.deepEqual(
      actual.map((r) => [r.load, r.reps]),
      [
        [80, 8],
        [70, 6],
        [70, 6],
      ],
    );
    assert.equal(await page.locator("#undoDraft").isDisabled(), true);
    // A correction is pending; neither finalized later sets nor history can be propagated over.
    await form(0).locator('[name="load"]').fill("85");
    assert.deepEqual(await values("load"), ["85", "70", "70"]);
    assert.deepEqual((await store()).records, completed);
    await page.locator("#undoDraft").click();
    assert.deepEqual(await values("load"), ["80", "70", "70"]);
    assert.deepEqual((await store()).records, completed);
    await page.setViewportSize({ width: 320, height: 740 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await bench.evaluate((e) =>
      scrollTo(0, e.getBoundingClientRect().top + scrollY - 12),
    );
    await page.locator("#notice").evaluate((e) => (e.textContent = ""));
    const narrowHeight = await bench
      .locator(".logging-area")
      .evaluate((e) => e.getBoundingClientRect().height);
    assert.ok(
      narrowHeight >= 200 && narrowHeight <= 250,
      `320px logging height: ${narrowHeight}`,
    );
    console.log(
      `PASS table geometry: 390px ${geometry.height}px, 320px ${narrowHeight}px; 48px set rows`,
    );
    await page.screenshot({
      path: "docs/screenshots/mobile-compact-table-320.png",
    });
    assert.ok(
      await bench
        .locator(".set-row")
        .evaluateAll((rows) =>
          rows.every((r) => r.getBoundingClientRect().height <= 48),
        ),
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await bench.evaluate((e) =>
      scrollTo(0, e.getBoundingClientRect().top + scrollY - 12),
    );
    await page.locator("#notice").evaluate((e) => (e.textContent = ""));
    await page.screenshot({
      path: "docs/screenshots/desktop-compact-logging.png",
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS compact logging: forward-only independent fields, top/back-off and side boundaries, reload/Undo, draft backup UI, atomic Finish, finalized records and athlete isolation; 320/390/1440 widths",
    );
  } finally {
    await context.close();
  }
}
