# FlyFightWin

A mobile-first static training application for the approved eight-week athletic strength and running block. Navy/gold design, separate athlete histories, individual set logging, transparent load suggestions and reversible browser-local migration. No backend or build step.

## Run and test

Requires Python 3 for the local server and Node 22+ for tests. Browser tests use system Chromium (or `CHROMIUM_PATH`).

```sh
npm ci
npm test
python3 -m http.server 8000 --bind 0.0.0.0
# In another terminal, from this directory:
npm run test:browser
```

`FFW_URL` overrides the browser-test server URL. Browser tests use isolated profiles and synthetic data. They regenerate screenshots under `docs/screenshots/`.

## Architecture

- `data/program.json`: one validated program master, with all 96 active athlete sessions, 16 rest days, 566 exercise rows, six source overview pages and the source PDF SHA-256. Each row retains source wording, grouping, order, rest, optional status and load metadata.
- `src/program.js`: runtime schema/integrity validation. `scripts/extract_program.py` reconstructs program rows from PDF coordinates using PyMuPDF; `scripts/audit_pdf.py` independently verifies every cell with pdfplumber. Python extraction packages are authoring tools only, not application dependencies.
- `src/model.js`: versioned local storage, validated non-destructive imports, athlete-scoped merges, retained conflicts, checkpoints, optimistic stale-tab detection and edit revisions. `src/calculations.js`: pure load, progression and VDOT calculations.
- `src/app.js`: native browser module rendering Today, Plan, Progress and History. No runtime dependencies, external fonts, analytics or network data transmission.
- `legacy.html` and existing `athletic-lifts.js`: original 28-week archive; old local records remain readable without writes to the legacy keys. `kitchen.html`: preserved nutrition content, recolored.

Data is stored in `flyfightwin.log.v3`. It remains local to the current browser. Static hosting does not provide phone synchronization. Original private fixtures are never bundled. Private baseline imports are optional; missing performance evidence produces an RPE-guided ramp, not invented loads.

Future approved changes use a versioned request processor; started/completed sessions retain immutable prescription snapshots. See [program update workflow](docs/PROGRAM_UPDATES.md).

See [phone migration instructions](docs/MIGRATION.md), [program integrity report](docs/PROGRAM_INTEGRITY.md), [validation evidence](docs/VALIDATION.md), [screenshots](docs/SCREENSHOTS.md), and [review items](REVIEW_REQUIRED.md).

## Calculation boundaries

Top-set starting bands are provisional coaching aids, not replacements for the PDF's RPE caps. Bands use only exact-lift performed data (Epley, 1–10 reps); the latest recorded matching set is identified with date/provenance. Unknown RPE is shown as unknown. A recorded effort above the current cap suppresses the numerical target. Back-offs use the actual saved matching-variant top load and round to the selected increment. Without that top set, only the rule is displayed.

Accessory increases require every prescribed set/side, matching variant and units, consistent load, upper-end reps, and explicitly recorded RIR meeting the target. Warmups are displayed separately. Device resistance, sleds, carries and power cleans receive no e1RM. An imported partial performance is not an entire completed workout.

## Static hosting

Serve the repository root at the existing Pages subpath. All application asset paths are relative; no build artifacts or routing rewrite are needed. `.nojekyll` disables Jekyll processing. `npm ci` installs development tools only. CI runs tests without deployment. This feature branch must be reviewed before merging; deployment has not been verified on production.
