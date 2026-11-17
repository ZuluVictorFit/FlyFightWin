# Strength estimates and suggested loads

The preferred method is the exact RTS RPE-to-%1RM chart supplied with the review request. `src/rts.js` transcribes its 96 cells: reps 1–12, RPE 6.5–10 in half points. Representative cells are independently asserted in `tests/loading.test.js` (including five reps at 7.5 = 79.9%, five at 8 = 81.1%, and twelve at 6.5 = 58.6%). There is no interpolation or extrapolation.

For eligible primary barbell lifts (Z press, conventional deadlift, reverse SSB squat, front squat), estimated 1RM = actual performed load / chart fraction at actual reps and recorded RPE. Suggested top load = estimated 1RM × chart fraction at upcoming top reps and the prescribed RPE cap. The cap is the upper effort target; any lower effort in the prescription remains acceptable. This advice does not alter prescriptions or actual records.

A synthetic worked example: 125 lb × 5 at RPE 7.5 gives 125 / 0.799 ≈ 156 lb. Five reps at RPE 8 gives 156.45 × 0.811 ≈ 127 lb, presented as 125–130 lb with 5 lb increments. Rounded ranges bracket the calculation; start at the lower load, and use the upper only if actual effort stays under the cap. These are estimates, not tested maxes or promises of performance.

Actual effort can be recorded as a single RPE or an ordered range such as 7–8, never both. Range endpoints produce an e1RM uncertainty interval; the subsequent load interval propagates it. No midpoint becomes a fictional completed effort. Unknown actual RPE stays unknown: neither the prescription nor RIR is substituted into the chart. Inputs outside the chart remain stored as reported, but receive no chart estimate. New fields are optional, so existing historical records and backups remain valid.

Each estimate uses only the same athlete, exact variation, load unit and completed top set (or explicitly performed historical baseline). Back-offs, skipped records, other lifts and the other athlete cannot become the reference. Known effort exceeding the original session cap triggers an RPE-guided reduction. A deliberately lower upcoming cap can instead use the chart to calculate reduced loading when the prior effort was within its own saved prescription.

The unadjusted Epley estimate and old initial percentage band remain explicitly labeled **fallback references**, never the preferred submaximal recommendation. They are limited to supported lifts and 1–10 completed reps; without valid actual/target chart evidence, the top-set recommendation is an RPE-guided ramp, not a fabricated precise load. Progress labels RTS and Epley references separately.

The chart is not used for sleds, carries, explosive cleans, push presses, dumbbell loads or device settings. Existing power-movement advice remains separate. Actual saved top-load back-off calculations and accessory double progression are unchanged. No approved exercise, volume, recovery or running prescription was modified.
