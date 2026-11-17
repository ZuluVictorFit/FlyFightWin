# Validation evidence

All application screenshots and browser-test entries are **synthetic test data**, never supplied athlete records.

| Check | Actual result |
|---|---|
| `npm test` | 70 tests passed; 0 failed, skipped or cancelled |
| `npm run test:browser` | All 96 active athlete sessions rendered and saved a working set; every prescribed working-set editor/side present |
| PDF reconciliation | 566 rows / 2,830 cells / all 48 daily pages matched independently; six overview pages retained |
| Private original exports + combined + baseline | Athlete-scoped merge equals combined; legacy history unchanged; idempotence; partial records preserved; estimates excluded from completed sets; v3 roundtrip lossless |
| Browser workflows | Top/back-off calculation, reload persistence, accessory editor, weekly plan, progress/history, JSON export/import, malformed JSON rejection, legacy migration and read-only archive passed |
| Program revisions | Targeted exercise/session/week/block changes; untouched-athlete protection; immutable completed-session snapshots; recalculation against revised targets; stale/ambiguous/missing prescription rejection passed |
| Responsive browser checks | Chromium touch/mobile viewport 390×844; narrow 320×740; desktop 1440×1000; no page overflow detected |
| Accessibility | axe-core WCAG 2 A/AA and 2.1 AA audit on the rendered mobile workout: zero violations |
| JavaScript | No application page errors during browser suite |

`tests/core.test.js` validates storing every working set and unilateral side throughout the block. Browser tests save one working set in each of the 96 active sessions and two main top sets; they do not claim a user performed those workouts. A browser regression also supplies a synthetic new master: saved sessions retain their original prescriptions and store bytes, while a fresh unstarted session renders the revised target without UI changes.

Private test command (fixture contents are not printed or committed):

```sh
node scripts/test_private.mjs /private/path/to/private_data
```

PDF authoring audit command:

```sh
python3 scripts/audit_pdf.py /private/path/FlyFightWin_8_Week_Athletic_Strength.pdf
```

## Contrast

Calculated relative-luminance ratios for the actual design tokens:

| Text | Main navy | Deep navy | Card surface | Raised surface |
|---|---:|---:|---:|---:|
| Off-white | 13.21:1 | 14.69:1 | 11.36:1 | 9.03:1 |
| Muted text | 9.46:1 | 10.52:1 | 8.14:1 | 6.47:1 |
| Gold | 8.79:1 | 9.78:1 | 7.57:1 | 6.01:1 |

Gold buttons use deep-navy text, 9.78:1. All exceed 4.5:1 for normal text. Brass is not used for small text. Focus has a visible gold outline; selected controls include borders and semantic pressed state. Inputs use 16px text and at least 46px height. Critical logging has no horizontal page scroll in tested viewports.

## Limits and review

- Mobile Chromium emulation was tested; physical iPhone Safari and WebKit were not available in this environment. No hardware test is claimed.
- No GitHub Pages production deployment was performed. CI workflow is supplied without a deploy job; its remote run is not claimed until GitHub executes it.
- Device firmware, real equipment, and training-methodology conflicts remain listed in `REVIEW_REQUIRED.md`.
- Browser local storage remains device-specific; export/import is the supported transfer mechanism. Quota and stale-tab failures are tested in the storage layer; real device eviction cannot be prevented by the app.

Review update: CI is pinned to Ubuntu 24.04 for Playwright 1.58.2. RTS lookup, uncertainty, practical rounding, missing-effort and lift-isolation regressions are included. See [loading method](LOADING_METHOD.md). Remote CI results are reported separately after the run.

## Compact table logging

The refined interface uses one five-column table and one advanced-details section per exercise, with no per-set forms or Save buttons. Automated browser assertions require 44–48 px set rows, a 200–250 px three-set logging area, and no horizontal page overflow at 320 px. Measured at 390 px: rows 48 px; logging area 222 px. Alternate effort and per-set details are edited through the exercise's single set selector.

Regression coverage includes independent forward propagation, top/back-off and left/right boundaries, finalized-record protection, Undo after reload, draft backup/import through the UI, atomic Finish Workout, snapshot freezing, stale imported history, failed writes, and athlete isolation. All 47 earlier unit tests remain included. The full browser suite finalizes one synthetic working result in each of the 96 active sessions, explicitly skipping other required rows; the unit suite separately finalizes every required working set/side across all sessions. Private migration fixtures remain outside the repository. See [logging behavior](COMPACT_LOGGING.md).

## Watch interval measurements

70 unit tests include the original regressions plus pace/time parsing, the three Week 1 Tuesday Watch intervals, independent HR, propagation boundaries, 48 running sessions, preserved VDOT/pins, rounded measurements, new-field validation, old draft/record compatibility and backup revisions. Browser coverage saves the exact synthetic 0.66/0.67/0.68 mi, 7:29/7:27/7:20, 160/162/164 bpm example; checks autosave, Undo, atomic Finish, corrections, scoped UI imports, meter intervals and actual time-trial finishes; and sweeps all 48 running sessions for both athletes at 320 px. The entire existing browser suite also runs. Screenshots at 390 and 320 px show 48 px rows and no horizontal page overflow; axe A/AA passes on the running screen.

The manual private migration check now expects the already approved 13:43/44.78627792342048 VDOT baseline from current main, replacing its obsolete pre-#4 test expectation of 47.2. Application baselines, formulas, selection logic and all program data are unchanged.
