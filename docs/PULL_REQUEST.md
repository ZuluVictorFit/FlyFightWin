Working-set logging previously required separate vertical forms and per-set saves. This change provides one compact spreadsheet per exercise and a single Finish Workout action.

- Five columns: Set, Weight, Reps, the relevant RIR/RPE metric, and completion checkmark. Running and carries retain their appropriate time/distance fields. One exercise-level details section exposes alternate effort and individual set metadata.
- Measured mobile geometry: 48 px rows and a 222 px three-set logging area. All five columns fit at 320 px without horizontal scrolling.
- Weight, reps and actual effort propagate forward independently within the same exercise, side and top/back-off group. Earlier and finalized rows are protected.
- Required sets start checked; optional sets start unchecked. Exact prescribed reps prefill, while ranges and unknown actual effort stay unfilled. Draft autosave and Undo survive reload and full-backup imports.
- Finish validates all checked rows before one storage write. Direct corrections retain prior finalized records in revisions. Drafts stay separate from performance history, calculations and completed-workout counts.

Validation:

- `npm test`: 60 passed; none failed or skipped, including all 47 previous regressions.
- Complete browser suite: all 96 active sessions rendered and finalized a synthetic working result; every working-set/side editor checked. Mobile 390 px and 320 px, desktop 1440 px, axe WCAG A/AA, backup/import, program snapshots, RTS ranges, legacy storage protection and compact-table interactions passed.
- Private original exports and newer baselines passed lossless migration tests outside the repository.
- Approved program data, RTS lookup, calculation module, archive and nutrition page are byte-for-byte unchanged from the approved baseline. No private fixtures are committed.

Review the [logging behavior](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/compact-logging-table/docs/COMPACT_LOGGING.md) and [validation details](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/compact-logging-table/docs/VALIDATION.md).

Screenshots contain synthetic QA values only: 80×8, 70×6, 70×6.

![390 px mobile compact table](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/compact-logging-table/docs/screenshots/mobile-compact-table.png?raw=true)

![320 px mobile compact table](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/compact-logging-table/docs/screenshots/mobile-compact-table-320.png?raw=true)

Physical iPhone Safari was not tested; mobile validation uses Chromium emulation. Phone data migration remains a separate user-verified action. No merge or deployment is authorized by this PR.
