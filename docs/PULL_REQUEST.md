Rebuild FlyFightWin around the approved eight-week program and preserve existing phone histories through a versioned, reversible migration.

The static navy/gold application includes all 96 active athlete sessions, 16 rest days, individual working-set/side logging, actual-top-set back-offs, percentage guidance with provenance/RPE caps, accessory progression, running references/logs, exercise trends, separate athletes, and validated JSON merge/rollback. The 28-week archive and nutrition page remain available.

Program data is separate from rendering, logs and calculations. Approved change requests can target an exercise, one athlete's session/week, or a whole block. Started/completed sessions retain their original program revision and full prescription snapshots. Future updates recalculate upcoming targets without rewriting historical results or the other athlete's prescriptions.

Review fixes pin CI to Ubuntu 24.04 and use the supplied RTS chart for eligible submaximal barbell estimates, including half-point RPE and uncertainty ranges. See [loading method](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/eight-week-navy-gold/docs/LOADING_METHOD.md). Existing prescriptions and historical records are unchanged.

Validation performed locally:

- 47 automated tests passed, none failed or skipped.
- Browser suite rendered and saved a working set in all 96 active sessions; checked every working-set editor, reload persistence, top/back-off calculation, plan, progress/history, backup restore and legacy protection.
- Browser regression confirmed a data-only revision preserves saved sessions and applies revised targets to unstarted sessions.
- Independent PDF audit matched all 566 rows / 2,830 cells across 48 daily pages; six overview pages retained.
- Supplied private phone exports, combined backup and newer baselines passed lossless/idempotent migration tests outside the repository.
- Mobile 390×844, narrow 320×740 and desktop 1440×1000 checked. axe WCAG A/AA audit reported zero violations; minimum tested text/surface contrast is 6.01:1.

Review artifacts:

- [Phone migration and rollback](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/eight-week-navy-gold/docs/MIGRATION.md)
- [Future programming update workflow](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/eight-week-navy-gold/docs/PROGRAM_UPDATES.md)
- [Validation details and limitations](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/eight-week-navy-gold/docs/VALIDATION.md)
- [All screenshots](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/eight-week-navy-gold/docs/SCREENSHOTS.md)
- [Prescription/equipment review items](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/eight-week-navy-gold/REVIEW_REQUIRED.md)

![Phone main-lift logging — synthetic test data](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/eight-week-navy-gold/docs/screenshots/mobile-main-lift.png?raw=true)

![Desktop progress — synthetic test data](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/eight-week-navy-gold/docs/screenshots/desktop-progress.png?raw=true)

Private athlete fixtures and reference branding artwork are excluded. Screenshots contain synthetic QA data only. There is no live phone synchronization, paid service or health integration. Physical iPhone Safari/WebKit and real VOLTRA firmware were not tested; production Pages deployment was not performed. Heavy-carry equipment, VOLTRA mode availability, deload-volume convention and active VDOT selection remain explicit review items. No merge or deployment is requested by this PR creation step.
