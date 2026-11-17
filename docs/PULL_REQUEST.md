Running intervals can now be logged directly from Apple Watch's Intervals screen in the existing compact table: **Set | Distance | Avg Pace | HR | ✓**.

- Distance defaults to miles, with explicit meter support. Pace is entered as M:SS per mile and stored as seconds per mile. Optional HR stays individual; distance and pace propagate only forward into compatible unfinalized intervals.
- Programmed duration/recovery remain visible and separate from measured results. Actual elapsed time is available in Details, with a directly visible required finish time for two-mile trials. Distance, pace and elapsed time are never recomputed to force agreement.
- Draft autosave, Undo, atomic Finish Workout, historical revisions and athlete-scoped backups preserve all new fields. Old records and drafts remain compatible. New measurements start blank.
- No program, schedule, strength/RTS calculation, VDOT formula, current baseline or reference-selection logic changed. No Watch integration service or analytics dashboard was added.

Validation: **70 unit tests passed**, including all prior regressions. The complete browser suite passed all 96 active sessions plus a dedicated sweep of all 48 running sessions for both athletes, the exact Week 1 Tuesday example, meters, time trials/VDOT, independent HR, propagation, reload/Undo, corrections, full backup/restore and scoped imports. Running-screen axe A/AA passed; rows remain 48 px at 320 px and 390 px without horizontal overflow. Supplied private migration fixtures passed outside the repository. The migration test's stale 47.2 expectation was updated to main's already approved 13:43-derived VDOT; application baseline data is unchanged.

[Measurement/storage details](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/watch-interval-logging/docs/RUNNING_LOGGING.md)

Screenshots use synthetic interval values only:

![390 px Watch interval logger](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/watch-interval-logging/docs/screenshots/mobile-watch-intervals-390.png?raw=true)

![320 px Watch interval logger](https://github.com/ZuluVictorFit/FlyFightWin/blob/feat/watch-interval-logging/docs/screenshots/mobile-watch-intervals-320.png?raw=true)

Mobile testing used Chromium emulation, not a physical iPhone or Watch. No private records were committed. No merge or deployment is authorized by this PR.
