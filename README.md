# Operation Fly, Fight, Win

Static GitHub Pages site for the Zack / Hannah Air Force OTS preparation block.

## Files

- `index.html` — 28-week training page, VDOT pacing, strength loading, local logs.
- `kitchen.html` — nutrition page carried over from the prior build.
- `.nojekyll` — tells GitHub Pages to serve the files as-is.

## Deploy

Upload all three files to the root of the repository used by GitHub Pages. Keep the filenames unchanged.

The training page keeps the same browser-local storage keys as the prior version:

- page state: `blueline3`
- training log: `blueline.log.v2`

That means an existing browser should retain its saved week/day and training log when `index.html` is replaced. Clearing site data still erases browser-local logs.

## Current structure

- Monday: upper strength + PT work
- Tuesday: quality run
- Wednesday: squat / lower strength
- Thursday: easy aerobic run
- Friday: hinge / total-body strength + PT work
- Saturday: long aerobic run
- Sunday: off

Weeks 1-4 retain the prior calendar layout as history. The revised weekly structure starts in week 5.

## Strength cycles

Cycle 1 runs through week 12 with incline bench, back squat and trap bar. Week 9 uses a rep-calibration set. Enter only the reps completed; the page handles the working-max adjustment.

Week 13 starts Cycle 2 with new 3RM tests on flat bench, **Reverse SSB or Front Squat**, and conventional deadlift. The page converts each 3RM to a working max automatically. Week 17 uses the same reps-only calibration process.

## Notes

The site has no build step and no backend. The only external request is Google Fonts. Logs remain on the device/browser unless exported.
