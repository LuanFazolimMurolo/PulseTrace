import { AlertTriangle, CircleHelp, ShieldCheck } from "lucide-react";
import type { Observation } from "../core/types";
import { guidanceFor } from "../analysis/guidance";
import { dateTime, duration, number, severityLabel } from "../core/format";
export function ObservationCard({
  observation: o,
  compact = false,
}: {
  observation: Observation;
  compact?: boolean;
}) {
  const guidance = guidanceFor(o);
  const Icon =
    o.severity === "insufficient"
      ? CircleHelp
      : o.severity === "normal"
        ? ShieldCheck
        : AlertTriangle;
  return (
    <article className={`observation ${o.severity}`}>
      <div className="observation-icon">
        <Icon size={18} />
      </div>
      <div className="observation-body">
        <div className="observation-title">
          <strong>{o.title}</strong>
          <span className={`badge ${o.severity}`}>
            {severityLabel[o.severity]}
          </span>
        </div>
        <p>{guidance.meaning}</p>
        {!compact && <p className="guidance-area"><strong>Onde investigar:</strong> {guidance.area}</p>}
        <div className="observation-meta">
          <span>{o.component}</span>
          <span>{dateTime(o.time)}</span>
          {o.value !== null && (
            <span>
              {number(o.value)} {o.unit}
            </span>
          )}
          {o.duration !== null && (
            <span>{duration(o.duration)} observados</span>
          )}
        </div>
        {!compact && (
          <details>
            <summary>Evidências e próximas verificações</summary>
            <dl>
              <dt>Sensor</dt>
              <dd>{o.sensor}</dd>
              <dt>O que pode explicar</dt>
              <dd>{guidance.possibilities.join(" · ")}</dd>
              <dt>O que verificar primeiro</dt>
              <dd>{guidance.nextSteps.join(" · ")}</dd>
              <dt>Limite da análise</dt>
              <dd>{guidance.caution}</dd>
              <dt>Confiança na observação</dt>
              <dd>{o.confidence} — não é certeza de defeito.</dd>
            </dl>
          </details>
        )}
      </div>
    </article>
  );
}
