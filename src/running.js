// Presentation and validation only. These measurements never calculate VDOT.
export const isTimeTrial = (e) => e.exerciseId === "2-mile-time-trial";
export const defaultDistanceUnit = (e) =>
  /\bm\b/.test(e.prescription) ? "m" : "mi";

export function parsePace(value) {
  if (value === "") return null;
  if (!/^\d{1,2}:[0-5]\d$/.test(value))
    throw Error(
      "Enter average pace as M:SS or MM:SS per mile (seconds 00–59).",
    );
  const [m, s] = value.split(":").map(Number),
    seconds = m * 60 + s;
  if (!seconds) throw Error("Average pace must be greater than zero.");
  return seconds;
}
export function formatPace(seconds) {
  if (seconds == null || seconds === "") return "";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function parseElapsed(value) {
  if (value === "") return null;
  if (!/^(?:\d{1,2}:)?\d{1,3}:[0-5]\d(?:\.\d+)?$/.test(value))
    throw Error("Enter actual elapsed time as M:SS or H:MM:SS.");
  const parts = value.split(":").map(Number);
  if (parts.length === 3 && parts[1] > 59)
    throw Error("Elapsed-time minutes must be 00–59 after hours.");
  const seconds = parts.reduce((n, part) => n * 60 + part, 0);
  if (!seconds) throw Error("Actual elapsed time must be greater than zero.");
  return seconds;
}
export function formatElapsed(seconds) {
  if (seconds == null || seconds === "") return "";
  const n = Number(seconds),
    minutes = Math.floor(n / 60);
  const [whole, fraction] = String(Number((n - minutes * 60).toFixed(6))).split(
    ".",
  );
  const remainder = whole.padStart(2, "0") + (fraction ? `.${fraction}` : "");
  return `${minutes}:${remainder}`;
}
export function planTiming(e) {
  const work = e.prescription.match(/^(?:\d+\s*x\s*)?(\d+) (min|sec)(?:\b)/);
  const recovery = e.rest.match(/^(?:(\d+) min(?: (\d+) sec)?|(\d+) sec)(.*)$/);
  return [
    work &&
      `Prescribed work ${formatElapsed(+work[1] * (work[2] === "min" ? 60 : 1))}`,
    recovery &&
      `Recovery ${formatElapsed(+(recovery[1] || 0) * 60 + +(recovery[2] || recovery[3] || 0))}${recovery[4]}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
