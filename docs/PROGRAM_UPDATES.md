# Apply an approved programming update

Programming decisions remain with the athletes/coach. This workflow implements an already approved request; it does not authorize a new exercise, load, volume or running prescription.

## Boundaries

`data/program.json` is the single versioned prescription master. `blockId` identifies an eight-week (or future differently sized) block; `version` is an increasing revision; `id` uniquely identifies that revision. Session IDs include the block identity, week, day and athlete. Exercise slot IDs remain stable within a session, while `exerciseId` identifies the actual movement variant for history/progression matching.

Logs live exclusively in browser storage and private exports, never in the program master. Every started session and active logging draft stores its full prescription snapshot and original program revision. Draft values remain separate from actual performance until Finish Workout. Each set also stores its prescribed exercise snapshot, actual performance, performed date and pace reference where relevant. Editing a set retains the prior record revision. Publishing a changed master never rewrites these records. Started and completed sessions keep their saved prescriptions; the UI flags when the master is newer. Upcoming, unstarted sessions use the new master. Old-block sessions remain editable from History via their saved snapshots.

Calculations consume the selected prescription and matching performance records. They do not mutate either. Updating target reps/RIR changes next-target advice on unstarted sessions; it does not rewrite past reps, loads, RPE/RIR or dates. Changing a movement identity means previous different-variant performances are not a matching reference. New blocks must use a new `blockId` and new session IDs to avoid overwriting earlier block logs.

## Structured request

Supply JSON with this envelope, using the current revision as `baseProgramId`:

```json
{
  "schema": "flyfightwin.program-change.v1",
  "id": "coach-approved-request-identifier",
  "approved": true,
  "approvalReference": "Reference to the separately approved instruction",
  "baseProgramId": "athletic-strength-8-v1",
  "nextProgramId": "athletic-strength-8-v2",
  "nextVersion": 2,
  "changes": []
}
```

An empty `changes` array is deliberately rejected. Populate it with one or more approved changes using these supported scopes:

| Scope | Required fields | Effect |
|---|---|---|
| `exercise` | `athlete`, `week`, `day`, `exerciseId` (stable slot ID), `patch` | Updates only that exercise. Slot ID/order cannot be patched. |
| `session` | `athlete`, `week`, `day`, `session` (complete replacement) | Replaces one session, preserving its identity. |
| `week` | `athlete`, `week`, `sessions` (all seven days) | Replaces one athlete's week, including explicit rest days. |
| `block` | `program` (complete validated master), `allowExerciseChange: true` | Replaces the entire block. Must be the only change in the request. |

Changing movement names/identities, exercise order, or adding/removing exercises also requires `allowExerciseChange: true` on that specific change. This guard makes a substitution visible for review. It is not a substitute for the approval referenced in the request. Another athlete cannot be selected implicitly: session/week replacements are checked against the explicit athlete and week.

Prescriptions include human-readable source wording **and** calculation metadata. Approved rep/effort changes must update both (for example `prescription` with `repRange`, or `intensity` with `rpeCap`/`rir`/`top.backPercent`). Set counts and `setsText` must agree. Validation rejects contradictory fields instead of guessing the new methodology. Keep group, order, rest, optional status, warmup flag, load unit, unilateral flag, and run type explicit. For a new block, supply all seven days for every week and both athletes; mark rest days with `restDay: true`. `paceDefaults` records each athlete's approved default reference and whether new two-mile tests may update it automatically.

## Engineering steps

1. Start a feature branch from the reviewed version. Keep the approval/request outside the public checkout if it contains personal performance or private discussion. Use a sanitized request identifier/reference in committed provenance.
2. Generate a candidate without touching the active master:

   ```sh
   node scripts/apply_program_change.mjs /private/approved-request.json /tmp/program-candidate.json
   ```

   The tool rejects stale base versions, missing approval references, unknown targets, implicit substitutions, contradictory prescriptions and incomplete blocks. It refuses to overwrite the current master or an existing output file.
3. Review the printed affected-session list and compare the candidate to `data/program.json`. Confirm the other athlete and untargeted sessions are unchanged. Verify new words, volume, rest/recovery, equipment and loading metadata against the actual approval. For original-PDF changes, the retained PDF overview is historical source material; update annotations in the change request instead of claiming the old PDF describes revised sessions.
4. Copy the reviewed candidate to `data/program.json` on the feature branch. Do not rerun the original-PDF extractor over a later revision: that extractor is specifically for reconstructing v1.
5. Run `npm test` and the browser suite. Add explicit expected prescription assertions from the approved request, including an untouched-athlete assertion. The existing v1 source audit is a baseline-specific test; update its version-specific expectations when approval changes the baseline. Keep the version/change-request invariants and historical-snapshot regression tests.
6. Test a private exported store against the new master locally: existing completed sessions must retain their full snapshots; unstarted targeted sessions must display the changed prescription and recalculate advice. Export before testing. Never commit the store or screenshots of real records.
7. Submit a PR with approval reference, targeted diff, test results, screenshots and any ambiguity. Do not merge/deploy without approval. A rollback of `data/program.json` affects the master only; no logged performance migration or destructive rewrite is necessary.

A new exercise supported by existing set/time/distance/device fields needs data only. A fundamentally new measurement type would need an explicit schema/calculation extension and tests, rather than pretending an existing metric is equivalent.
