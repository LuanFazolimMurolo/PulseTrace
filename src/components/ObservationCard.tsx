import { AlertTriangle, CircleHelp, ShieldCheck } from "lucide-react";
import type { Observation } from "../core/types";
import { dateTime, duration, number, severityLabel } from "../core/format";
export function ObservationCard({
  observation: o,
  compact = false,
}: {
  observation: Observation;
  compact?: boolean;
}) {
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
        <p>{o.explanation}</p>
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
              <dt>Possíveis causas</dt>
              <dd>{o.causes.join(" · ") || "Nenhuma causa estabelecida."}</dd>
              <dt>Próximas verificações</dt>
              <dd>
                {o.checks.join(" · ") || "Colete mais leituras e contexto."}
              </dd>
              <dt>Confiança: {o.confidence}</dt>
              <dd>{o.limitation}</dd>
            </dl>
          </details>
        )}
      </div>
    </article>
  );
}
