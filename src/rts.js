// Exact transcription of the user-supplied RTS chart. Columns are reps 1–12.
// No interpolation or extrapolation. Percentages retain the chart's precision.
export const RTS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      10: [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68],
      9.5: [
        97.8, 93.9, 90.7, 87.8, 85, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7,
      ],
      9: [95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68, 65.3],
      8.5: [93.9, 90.7, 87.8, 85, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64],
      8: [92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68, 65.3, 62.6],
      7.5: [90.7, 87.8, 85, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64, 61.3],
      7: [89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68, 65.3, 62.6, 59.9],
      6.5: [87.8, 85, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64, 61.3, 58.6],
    }).map(([k, v]) => [k, Object.freeze(v)]),
  ),
);
export const rtsEligible = (id) =>
  [
    "barbell-z-press",
    "conventional-barbell-deadlift",
    "reverse-ssb-squat",
    "front-squat",
  ].includes(id);
export function rtsPercent(reps, rpe) {
  return Number.isInteger(reps) && reps >= 1 && reps <= 12
    ? (RTS[rpe]?.[reps - 1] ?? null)
    : null;
}
export function actualRpeRange(record) {
  if (record.rpeRange != null) return record.rpeRange;
  return Number.isFinite(record.rpe) ? [record.rpe, record.rpe] : null;
}
export function rtsEstimate(record) {
  if (
    !rtsEligible(record.variant) ||
    record.unit !== "lb total" ||
    record.status !== "done" ||
    !(record.load > 0)
  )
    return null;
  const effort = actualRpeRange(record);
  if (!Array.isArray(effort) || effort.length !== 2 || effort[0] > effort[1])
    return null;
  const low = rtsPercent(record.reps, effort[0]),
    high = rtsPercent(record.reps, effort[1]);
  if (low == null || high == null) return null;
  return {
    method: "RTS",
    range: [record.load / (high / 100), record.load / (low / 100)],
    effort,
    percent: [low, high],
  };
}
