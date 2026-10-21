import { useMemo, useRef, useState } from "react";
import { Search, Upload, Info } from "lucide-react";
import type { WindowsEvent } from "../core/types";
import { investigate, parseWindowsEvents } from "../analysis/investigate";
import { dateTime, duration } from "../core/format";
import { inputDate } from "../components/RangeBar";
import { ObservationCard } from "../components/ObservationCard";
import { Chart } from "../components/Chart";
import type { PageProps } from "./Dashboard";
export function Investigation(props: PageProps) {
  const [stamp, setStamp] = useState(
    inputDate(props.session.times[props.session.times.length - 1]),
  );
  const [minutes, setMinutes] = useState(5);
  const [events, setEvents] = useState<WindowsEvent[]>([]);
  const [correction, setCorrection] = useState(0);
  const [query, setQuery] = useState<{ time: number; minutes: number } | null>(
    null,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const result = useMemo(
    () =>
      query
        ? investigate(
            props.session,
            query.time,
            query.minutes,
            events,
            correction,
          )
        : null,
    [props.session, query, events, correction],
  );
  async function importEvents(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("O JSON excede 5 MiB.");
      setEvents(parseWindowsEvents(await file.text()));
    } catch (e) {
      props.onError(String(e));
    }
  }
  return (
    <>
      <section className="panel investigation-intro">
        <div className="insight-symbol">
          <Search size={24} />
        </div>
        <div>
          <h3>Vamos examinar os minutos anteriores.</h3>
          <p>
            Informe aproximadamente quando a falha ocorreu. O PulseTrace mostra
            as evidências disponíveis e as lacunas do registro.
          </p>
        </div>
      </section>
      <section className="panel form-row">
        <label>
          Horário aproximado da falha
          <input
            aria-label="Horário aproximado da falha"
            type="datetime-local"
            step="0.001"
            value={stamp}
            onChange={(e) => setStamp(e.target.value)}
          />
        </label>
        <label>
          Período anterior
          <select value={minutes} onChange={(e) => setMinutes(+e.target.value)}>
            <option value={2}>2 minutos</option>
            <option value={5}>5 minutos</option>
            <option value={10}>10 minutos</option>
            <option value={30}>30 minutos</option>
          </select>
        </label>
        <button
          className="primary"
          onClick={() => {
            const t = new Date(stamp).getTime();
            if (Number.isFinite(t)) {
              setQuery({ time: t, minutes });
              props.onRange([
                Math.max(
                  props.session.times[0],
                  Math.min(
                    t - minutes * 60_000,
                    props.session.times[props.session.times.length - 1],
                  ),
                ),
                Math.max(
                  props.session.times[0],
                  Math.min(
                    t,
                    props.session.times[props.session.times.length - 1],
                  ),
                ),
              ]);
            } else props.onError("Informe um horário válido.");
          }}
        >
          <Search size={16} /> Investigar período
        </button>
      </section>
      {result && (
        <>
          <div className="stats-grid investigation-stats">
            <div className="stat-card">
              <span>Última amostra anterior à falha</span>
              <strong className="small-value">
                {result.lastSample === null
                  ? "Nenhuma"
                  : dateTime(result.lastSample)}
              </strong>
            </div>
            <div className="stat-card">
              <span>Distância até o horário informado</span>
              <strong>
                {result.lastSample === null
                  ? "—"
                  : duration(result.end - result.lastSample)}
              </strong>
            </div>
            <div className="stat-card">
              <span>Leituras na janela</span>
              <strong>{result.count}</strong>
            </div>
            <div className="stat-card">
              <span>Lacunas na janela</span>
              <strong>{result.gaps.length}</strong>
            </div>
          </div>
          <div className="info-box">
            <Info size={19} />
            <p>
              {result.count
                ? "Estas leituras podem ajudar a localizar anomalias observáveis, mas não estabelecem a causa da falha."
                : "Não há leituras na janela solicitada. Não é possível avaliar os minutos anteriores com este arquivo."}{" "}
              O último registro não comprova desligamento; Kernel-Power 41 não
              comprova defeito na fonte.
            </p>
          </div>
          {result.count > 0 && (
            <Chart
              {...props}
              sensors={props.session.sensors
                .filter((s) => s.metric === "temperature" && s.unit === "°C")
                .slice(0, 4)}
              title="Temperaturas próximas ao horário informado"
            />
          )}
          <section className="panel">
            <div className="panel-heading">
              <h3>Evidências disponíveis</h3>
            </div>
            {result.observations.length ? (
              result.observations.map((o) => (
                <ObservationCard key={o.id} observation={o} />
              ))
            ) : (
              <p className="empty-note">
                Nenhuma regra detectou anomalias com os dados disponíveis nesta
                janela. Isso não descarta falhas não registradas.
              </p>
            )}
          </section>
          {result.events.length > 0 && (
            <section className="panel">
              <div className="panel-heading">
                <h3>Eventos Windows próximos ao horário</h3>
              </div>
              {result.events.map((e, i) => (
                <div className="event-row" key={i}>
                  <strong>
                    {e.provider} · ID {e.id}
                  </strong>
                  <small>{dateTime(e.time)}</small>
                  <p>{e.message}</p>
                </div>
              ))}
            </section>
          )}
        </>
      )}
      <section className="panel form-panel">
        <h3>Eventos do Windows (opcional)</h3>
        <p>
          Importe um JSON local com TimeCreated (ISO 8601 com fuso), Id,
          ProviderName e Message. Veja o procedimento em
          docs/EVENTOS-WINDOWS.md. Os registros são somente leitura.
        </p>
        <div className="form-row compact">
          <button
            className="secondary"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} /> Importar eventos JSON
          </button>
          <span className="muted">{events.length} eventos carregados</span>
          <label>
            Ajuste do relógio dos eventos (segundos)
            <input
              type="number"
              min={-86400}
              max={86400}
              value={correction}
              onChange={(e) =>
                setCorrection(
                  Math.max(
                    -86400,
                    Math.min(86400, Number(e.target.value) || 0),
                  ),
                )
              }
            />
          </label>
        </div>
        <small>
          O ajuste é somado aos horários dos eventos. Compare relógios antes de
          interpretar coincidências.
        </small>
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept=".json"
          onChange={(e) => {
            void importEvents(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </section>
    </>
  );
}
