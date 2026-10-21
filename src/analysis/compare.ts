import type { Sensor, Session, TimeRange } from "../core/types";
export function stats(session: Session, sensor: Sensor, range?: TimeRange) {
  let min = Infinity,
    max = -Infinity,
    sum = 0,
    count = 0;
  for (let i = 0; i < session.times.length; i++) {
    if (range && (session.times[i] < range[0] || session.times[i] > range[1]))
      continue;
    const v = sensor.values[i];
    if (Number.isFinite(v)) {
      min = Math.min(min, v);
      max = Math.max(max, v);
      sum += v;
      count++;
    }
  }
  return {
    min: count ? min : null,
    max: count ? max : null,
    mean: count ? sum / count : null,
    count,
  };
}
export function compareSessions(a: Session, b: Session) {
  return a.sensors.map((sensor) => ({
    sensor,
    other:
      b.sensors.find(
        (s) => s.identity === sensor.identity && s.unit === sensor.unit,
      ) ?? null,
  }));
}
