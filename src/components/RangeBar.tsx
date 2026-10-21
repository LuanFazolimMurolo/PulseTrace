import { RotateCcw, SlidersHorizontal } from "lucide-react";
import type { Session, TimeRange } from "../core/types";
import { duration } from "../core/format";
export const inputDate = (time: number) => {
  const d = new Date(time);
  return new Date(time - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 23);
};
export function RangeBar({
  session,
  range,
  onChange,
}: {
  session: Session;
  range: TimeRange;
  onChange: (r: TimeRange) => void;
}) {
  const first = session.times[0],
    last = session.times[session.times.length - 1];
  const update = (index: 0 | 1, value: string) => {
    const t = new Date(value).getTime();
    if (!Number.isFinite(t)) return;
    const next: TimeRange = [...range];
    next[index] = Math.max(first, Math.min(last, t));
    if (next[0] <= next[1]) onChange(next);
  };
  return (
    <div className="range-bar">
      <span className="range-label">
        <SlidersHorizontal size={15} /> Intervalo
      </span>
      <label>
        <span className="sr-only">Início do intervalo</span>
        <input
          aria-label="Início do intervalo"
          type="datetime-local"
          step="0.001"
          value={inputDate(range[0])}
          min={inputDate(first)}
          max={inputDate(last)}
          onChange={(e) => update(0, e.target.value)}
        />
      </label>
      <span className="muted">até</span>
      <label>
        <span className="sr-only">Fim do intervalo</span>
        <input
          aria-label="Fim do intervalo"
          type="datetime-local"
          step="0.001"
          value={inputDate(range[1])}
          min={inputDate(first)}
          max={inputDate(last)}
          onChange={(e) => update(1, e.target.value)}
        />
      </label>
      <span className="range-duration">{duration(range[1] - range[0])}</span>
      <button
        className="icon-button"
        title="Restaurar intervalo completo"
        aria-label="Restaurar intervalo completo"
        onClick={() => onChange([first, last])}
      >
        <RotateCcw size={15} />
      </button>
    </div>
  );
}
