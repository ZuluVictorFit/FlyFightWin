# Apple Watch interval logging

The running table is **Set | Distance | Avg Pace | HR | ✓**, with one 48 px row per work interval. Enter each interval's measurements from the Watch Intervals screen, not whole-workout averages. Actual measurements start blank. Required work starts checked; optional work starts unchecked. Review checkmarks before Finish Workout.

Distance is in miles by default. Meter-based prescriptions open with meter units shown next to each distance cell. Select an individual interval in **Details & other effort** to change its unit between `mi` and `m`. Changing the unit does not convert or rewrite the entered distance. Average pace is always **per mile**, entered as `M:SS` or `MM:SS`; for example `7:29`. Average HR is optional, an integer from 20–300 bpm. Leave an unavailable or unusable reading blank.

Distance and pace edits propagate independently to later unfinalized rows in the same exercise, side, actual variant and distance unit. They never change earlier or finalized rows. HR, elapsed time, notes, dates and unit choices stay individual. Existing actual RPE/RIR remain available in the exercise-level Details section. Draft autosave, Undo, backup import and atomic Finish Workout retain these values; corrections preserve prior record revisions.

## Workout types

- **Timed intervals:** programmed work and recovery remain visible, including a clock-format annotation (Zack's Week 1 Tuesday: 3 × 5 min, work 5:00, recovery 1:15 easy jog). Log actual distance, pace and HR. Optional actual elapsed time is in Details and is never filled from the prescription.
- **Distance intervals:** prescribed distance and recovery remain visible. Actual distance is blank until entered and remains editable in meters or miles. Pace stays per mile. Optional actual elapsed time is in Details.
- **Two-mile time trials:** the explicit two-mile prescription and a directly visible actual finishing-time field remain available. Enter `M:SS` or `H:MM:SS`; a finishing time is required for a newly finalized trial. Pace alone cannot substitute for it. Existing VDOT formula, valid-test conditions, athlete baselines and pinned-reference behavior are unchanged. A supplied actual distance that does not meet the existing two-mile validation cannot produce a test reference.
- **Easy/long runs:** log actual total distance, pace and optional HR. Enter actual elapsed time in Details when available. A prescribed duration or distance never becomes an actual measurement automatically.

Warm-ups, preparation strides and cooldowns remain display-only wherever the approved program marks them as preparation. Strides prescribed as working rows retain their own editable rows; logging another run does not fill or complete those rows. Unperformed work should be unchecked. No extra recovery intervals or completed activities are generated.

## Record format and compatibility

The existing v3 backup format is retained. Running set records add optional `runMetricsVersion: 1`, `averagePaceSecondsPerMile` (integer seconds per mile) and `averageHr` (bpm). Existing `distance`, `distanceUnit`, `seconds`, effort, date, variant, pace-reference and prescription-snapshot fields retain their meanings. `seconds` is measured elapsed time only. Explicit elapsed-time entry records `elapsedTimeSource: "recorded"`; unknown elapsed time is null. Older stored times without source metadata are preserved rather than retrospectively relabeled.

Drafts retain the pace string as `pace`, HR input as `averageHr`, an explicit `distanceUnit`, and optionally the entered `elapsedTime` string. Partial/invalid input can autosave and be undone, but Finish rejects malformed pace/time, invalid units, nonpositive supplied distance/time, and invalid HR. New fields are optional when reading old drafts and records. Opening existing history does not calculate missing pace, HR or elapsed time, rewrite old records, or mark any workout complete.

Distance, pace and elapsed time are independent measurements. For example, `0.66 mi`, `7:29/mi` and `5:00` are accepted together despite Watch rounding. The app does not recompute any entered value to force agreement. Backups, athlete-scoped imports and prior revisions preserve each value. The stored interval slots, athlete, exact variant, dates and prescription snapshots support future analysis; no new analytics dashboard, VO2max inference or training-interval VDOT inference is introduced.

Screenshots and automated browser fixtures use synthetic data only. No Watch connection, external synchronization service or automatic device import is implemented.
