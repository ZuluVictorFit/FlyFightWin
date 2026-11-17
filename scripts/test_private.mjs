// Private fixtures are read from an explicit path outside this checkout. Only counts are printed.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import * as M from "../src/model.js";
import * as C from "../src/calculations.js";
const program = JSON.parse(
  fs.readFileSync(new URL("../data/program.json", import.meta.url)),
);
const dir = path.resolve(process.argv[2] || "");
assert.ok(
  process.argv[2] && !dir.startsWith(process.cwd() + "/"),
  "Pass a private fixture directory outside the repository",
);
const read = (n) => M.safeParse(fs.readFileSync(path.join(dir, n), "utf8"));
const z = read("zack_phone_backup_original.json"),
  h = read("hannah_phone_backup_original.json"),
  combined = read("fly-fight-win-combined-backup.json"),
  baseline = read("FlyFightWin_recent_baselines.json");
assert.deepEqual(combined.z, z.z);
assert.deepEqual(combined.h, h.h);
let d = M.importData(M.fresh(), z, ["z"]).data;
d = M.importData(d, h, ["h"]).data;
const c = M.importData(M.fresh(), combined).data;
assert.deepEqual(
  d.records.sort((a, b) => a.id.localeCompare(b.id)),
  c.records.sort((a, b) => a.id.localeCompare(b.id)),
);
assert.equal(M.importData(d, combined).added, 0);
assert.equal(M.importData(d, combined).conflicts, 0);
const untouched = M.canonical(d.records);
d = M.importData(d, baseline).data;
assert.equal(
  M.canonical(d.records.filter((r) => r.type === "legacy")),
  untouched,
);
assert.equal(d.records.filter((r) => r.type === "set").length, 5);
assert.equal(d.records.filter((r) => r.type === "session").length, 0);
assert.equal(C.runReferences(d, "z").length, 2);
assert.equal(C.activeReference(d, "z", program.paceDefaults).value, 47.2);
assert.equal(C.activeReference(d, "h", program.paceDefaults).value, null);
assert.equal(M.importData(d, baseline).added, 0);
const roundtrip = M.importData(M.fresh(), M.safeParse(JSON.stringify(d))).data;
assert.deepEqual(roundtrip.records, d.records);
assert.deepEqual(roundtrip.imports, d.imports);
for (const r of roundtrip.records.filter((r) => r.type === "set"))
  assert.ok(r.provenance.startsWith("performed"));
console.log(
  "PASS private fixtures: separate phone merge equals combined; all legacy records unchanged; baseline partial sets and provenance retained; estimates excluded; both test histories retained; idempotent import and lossless v3 roundtrip.",
);
