// No in-place or production write: review the generated candidate in a feature branch.
import fs from "node:fs";
import path from "node:path";
import { safeParse } from "../src/model.js";
import { applyChangeRequest } from "../src/program-changes.js";
const [requestFile, outputFile] = process.argv.slice(2);
if (
  !requestFile ||
  !outputFile ||
  path.resolve(outputFile) === path.resolve("data/program.json")
)
  throw Error(
    "Usage: node scripts/apply_program_change.mjs approved-request.json /tmp/program-candidate.json (output must differ from active master)",
  );
const current = safeParse(fs.readFileSync("data/program.json", "utf8")),
  request = safeParse(fs.readFileSync(requestFile, "utf8"));
const next = applyChangeRequest(current, request);
fs.writeFileSync(outputFile, JSON.stringify(next, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify(
    {
      from: current.id,
      to: next.id,
      targets: next.changeHistory.at(-1).targets,
      output: outputFile,
    },
    null,
    2,
  ),
);
