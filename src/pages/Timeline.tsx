import { useState } from "react";
import { Flag, Circle, AlertTriangle, Clock3 } from "lucide-react";
import type { Marker, Observation, TimeRange } from "../core/types";
import { dateTime, duration, number } from "../core/format";
import { stats } from "../analysis/compare";
import { Chart } from "../components/Chart";
import { inputDate } from "../components/RangeBar";
import type { PageProps } from "./Dashboard";
export function Timeline({
  observations,
  markers,
  onMarker,
  onRemove,
  ...props
}: PageProps & {
  observations: Observation[];
  markers: Marker[];
  onMarker: (m: Marker) => void;
  onRemove: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [stamp, setStamp] = useState(inputDate(props.range[1]));
  const [baseline, setBaseline] = useState<TimeRange | null>(null);
  const session = props.session;
  const entries = [
    ...observations
      .filter((o) => o.rule !== "last-sample")
      .map((o) => ({
        id: o.id,
        time: o.time,
        title: o.title,
        body: o.explanation,
        type: "alert",
      })),
    ...session.gaps.map((g, i) => ({
      id: `gap-${i}`,
      time: g.start,
      title: `Intervalo sem leituras · ${duration(g.duration)}`,
      body: `Próxima amostra: ${dateTime(g.end)}. Não há dados para avaliar este intervalo.`,
      type: "gap",
    })),
    ...markers.map((m) => ({
      id: m.id,
      time: m.time,
      title: m.text,
      body: "Marcador manual · contexto informado por você",
      type: "marker",
    })),
    {
      id: "end",
      time: session.times[session.times.length - 1],
      title: "Última leitura disponível",
      body: "O fim do arquivo não comprova desligamento ou travamento.",
      type: "end",
    },
  ]
    .filter((e) => e.time >= props.range[0] && e.time <= props.range[1])
    .sort((a, b) => a.time - b.time);
  function addMarker() {
    const t = new Date(stamp).getTime();
    if (
      !label.trim() ||
      !Number.isFinite(t) ||
      t < session.times[0] ||
      t > session.times[session.times.length - 1]
    ) {
      props.onError("Informe um texto e um horário dentro desta sessão.");
      return;
    }
    onMarker({
      id: crypto.randomUUID(),
      time: t,
      text: label.trim().slice(0, 300),
    });
    setLabel("");
  }
  return (
    <>
      <Chart
        {...props}
        sensors={session.sensors
          .filter((s) => s.metric === "temperature" && s.unit === "°C")
          .slice(0, 4)}
        title="Linha do tempo térmica"
        subtitle="Arraste o seletor inferior para ampliar; todos os gráficos acompanham o intervalo."
      />
      <div className="timeline-grid">
        <section className="panel">
          <div className="panel-heading">
            <h3>Eventos do registro</h3>
            <span className="badge">{entries.length} eventos</span>
          </div>
          <div className="timeline-list">
            {entries.map((e) => (
              <article key={e.id} className={`timeline-entry ${e.type}`}>
                <div className="timeline-dot">
                  {e.type === "marker" ? (
                    <Flag size={15} />
                  ) : e.type === "alert" ? (
                    <AlertTriangle size={15} />
                  ) : e.type === "end" ? (
                    <Clock3 size={15} />
                  ) : (
                    <Circle size={15} />
                  )}
                </div>
                <div>
                  <time>{dateTime(e.time)}</time>
                  <h4>{e.title}</h4>
                  <p>{e.body}</p>
                  {e.type === "marker" && (
                    <button
                      className="text-button"
                      onClick={() => onRemove(e.id)}
                    >
                      Remover marcador
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!entries.length && (
              <p className="empty-note">Nenhum evento neste intervalo.</p>
            )}
          </div>
        </section>
        <div className="chart-stack">
          <section className="panel form-panel">
            <h3>Adicionar contexto</h3>
            <p>
              Marque quando um jogo abriu, a imagem congelou ou o computador
              reiniciou.
            </p>
            <label>
              Horário
              <input
                type="datetime-local"
                step="0.001"
                value={stamp}
                onChange={(e) => setStamp(e.target.value)}
              />
            </label>
            <label>
              O que aconteceu?
              <input
                maxLength={300}
                placeholder="Ex.: o jogo parou de responder"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <button className="secondary" onClick={addMarker}>
              <Flag size={15} /> Adicionar marcador
            </button>
            <small>
              Marcadores ficam na memória enquanto a sessão está aberta.
            </small>
          </section>
          <section className="panel form-panel">
            <h3>Comparar intervalos</h3>
            <p>
              Fixe o período atual como A; depois selecione outro intervalo nos
              gráficos para ver B.
            </p>
            <button
              className="secondary"
              onClick={() => setBaseline([...props.range])}
            >
              Usar seleção como intervalo A
            </button>
            {baseline && (
              <>
                <small>
                  A: {dateTime(baseline[0])} — {dateTime(baseline[1])}
                </small>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Média</th>
                        <th>A</th>
                        <th>B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.sensors
                        .filter((s) => s.count)
                        .slice(0, 12)
                        .map((s) => (
                          <tr key={s.id}>
                            <td>{s.label}</td>
                            <td>
                              {number(stats(session, s, baseline).mean)}{" "}
                              {s.unit}
                            </td>
                            <td>
                              {number(stats(session, s, props.range).mean)}{" "}
                              {s.unit}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
