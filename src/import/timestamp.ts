import type { ImportOptions } from "../core/types";

export function parseTimestamp(
  date: string,
  time: string,
  options: ImportOptions,
): number {
  const combined = time ? `${date.trim()} ${time.trim()}` : date.trim();
  const m = combined.match(
    /^(\d{1,4})[.\/-](\d{1,2})[.\/-](\d{1,4})[ T]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:[.,](\d{1,3}))?\s*(AM|PM)?\s*(Z|[+-]\d{2}:?\d{2})?$/i,
  );
  if (!m) return NaN;
  let year: number, month: number, day: number;
  if (m[1].length === 4) [year, month, day] = [+m[1], +m[2], +m[3]];
  else {
    year = +m[3];
    [month, day] =
      options.dateOrder === "MDY" ? [+m[1], +m[2]] : [+m[2], +m[1]];
  }
  if (year < 100) year += 2000;
  let hour = +m[4];
  const minute = +m[5],
    second = +(m[6] || 0),
    ms = +(m[7] || "").padEnd(3, "0");
  if (m[8]) {
    if (hour < 1 || hour > 12) return NaN;
    hour = (hour % 12) + (m[8].toUpperCase() === "PM" ? 12 : 0);
  }
  if (
    year < 1970 ||
    year > 2200 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return NaN;
  const stamp = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  if (new Date(stamp).getUTCDate() !== day) return NaN;
  let offset = options.utcOffsetMinutes;
  if (m[9]) {
    if (m[9].toUpperCase() === "Z") offset = 0;
    else {
      const zone = m[9].replace(":", "");
      const h = +zone.slice(1, 3),
        min = +zone.slice(3, 5);
      if (h > 14 || min > 59 || (h === 14 && min !== 0)) return NaN;
      offset = (zone[0] === "-" ? -1 : 1) * (h * 60 + min);
    }
  }
  return stamp - offset * 60_000;
}
