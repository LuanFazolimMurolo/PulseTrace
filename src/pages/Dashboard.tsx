import {
  Activity,
  ArrowRight,
  Clock3,
  Cpu,
  Gauge,
  Thermometer,
  Zap,
} from "lucide-react";
import type { Observation, Session, TimeRange } from "../core/types";
import { duration, number, time } from "../core/format";
import { stats } from "../analysis/compare";
import { Chart } from "../components/Chart";
import { ObservationCard } from "../components/ObservationCard";
export interface PageProps {
  session: Session;
  range: TimeRange;
  onRange: (r: TimeRange) => void;
  light: boolean;
  onError: (s: string) => void;
}
export function Dashboard({
  session,
  range,
  onRange,
  light,
  onError,
  observations,
  navigate,
}: PageProps & { observations: Observation[]; navigate: (s: string) => void }) {
  const alerts = observations.filter(
    (o) => o.severity === "critical" || o.severity === "warning",
  );
  const temperatures = session.sensors.filter(
    (s) => s.metric === "temperature" && s.unit === "°C",
  );
  const cpu = temperatures.find((s) => s.component === "CPU"),
    gpu = temperatures.find((s) => s.component === "GPU");
  const cpuStats = cpu ? stats(session, cpu, range) : null,
    gpuStats = gpu ? stats(session, gpu, range) : null;
  const power = session.sensors
    .filter((s) => s.metric === "power" && s.unit === "W")
    .slice(0, 3);
  const invalid =
    session.quality.invalidTimestamps +
    session.quality.skippedRows +
    session.quality.incompleteRows +
    session.quality.invalidValues;
  const chartProps = { session, range, onRange, light, onError };
  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>Tempo de monitoramento</span>
            <Clock3 size={17} />
          </div>
          <strong>{duration(range[1] - range[0])}</strong>
          <p>
            {time(range[0])} <span>→</span> {time(range[1])}
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Temperatura da CPU</span>
            <Cpu size={17} />
          </div>
          <strong>
            {number(cpuStats?.max)} <small>°C</small>
          </strong>
          <p>
            Máxima <span>·</span> média {number(cpuStats?.mean)} °C
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Temperatura da GPU</span>
            <Thermometer size={17} />
          </div>
          <strong>
            {number(gpuStats?.max)} <small>°C</small>
          </strong>
          <p>
            Máxima <span>·</span> média {number(gpuStats?.mean)} °C
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Observações no intervalo</span>
            <Activity size={17} />
          </div>
          <strong className={alerts.length ? "text-amber" : "text-teal"}>
            {alerts.length.toString().padStart(2, "0")}{" "}
            <small>{alerts.length === 1 ? "alerta" : "alertas"}</small>
          </strong>
          <p>
            {alerts.filter((o) => o.severity === "critical").length} críticos{" "}
            <span>·</span>{" "}
            {alerts.filter((o) => o.severity === "warning").length} de atenção
          </p>
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="chart-stack">
          <Chart
            {...chartProps}
            sensors={[cpu, gpu].filter((s) => s !== undefined)}
            title="Temperaturas ao longo do tempo"
            subtitle="CPU e GPU · leituras registradas no CSV"
          />
          <div className="two-charts">
            <Chart
              {...chartProps}
              sensors={session.sensors
                .filter(
                  (s) =>
                    s.metric === "usage" &&
                    s.unit === "%" &&
                    ["CPU", "GPU", "Memória"].includes(s.component),
                )
                .slice(0, 3)}
              title="Utilização"
              subtitle="Carga registrada · %"
            />
            <Chart
              {...chartProps}
              sensors={power}
              title="Potência"
              subtitle="Consumo informado pelos sensores"
            />
          </div>
        </div>
        <aside className="dashboard-aside">
          <section className="panel session-panel">
            <div className="panel-heading">
              <h3>Sobre esta sessão</h3>
              <span className="live-dot" />
            </div>
            <dl className="session-details">
              <dt>Arquivo</dt>
              <dd className="filename" title={session.name}>
                {session.name}
              </dd>
              <dt>Leituras no arquivo</dt>
              <dd>{number(session.times.length, 0)}</dd>
              <dt>Sensores identificados</dt>
              <dd>{session.sensors.length}</dd>
              <dt>Intervalo típico</dt>
              <dd>
                {session.cadence
                  ? `${number(session.cadence / 1000)} s`
                  : "Não calculável"}
              </dd>
              <dt>Tamanho</dt>
              <dd>{number(session.size / 1024 / 1024, 2)} MiB</dd>
            </dl>
            <div
              className={`quality-box ${invalid || session.gaps.length ? "attention" : ""}`}
            >
              <Gauge size={18} />
              <div>
                <strong>
                  {invalid || session.gaps.length
                    ? "Registro com ressalvas"
                    : "Estrutura legível"}
                </strong>
                <p>
                  {session.gaps.length} lacunas · {invalid} problemas de
                  integridade
                </p>
              </div>
            </div>
            <button
              className="text-button"
              onClick={() => navigate("Linha do tempo")}
            >
              Explorar a linha do tempo <ArrowRight size={14} />
            </button>
          </section>
          <section className="panel insight-panel">
            <div className="insight-symbol">
              <Zap size={23} />
            </div>
            <h3>O que aconteceu antes da falha?</h3>
            <p>
              Examine os últimos minutos do registro e encontre pistas para sua
              investigação.
            </p>
            <button
              className="secondary full"
              onClick={() => navigate("Investigar desligamento")}
            >
              Investigar desligamento <ArrowRight size={15} />
            </button>
          </section>
          <div className="local-note">
            <span className="live-dot" />
            <span>
              Análise local. Seus registros
              <br />
              permanecem neste computador.
            </span>
          </div>
        </aside>
      </div>
      <section className="panel observations-panel">
        <div className="panel-heading">
          <div>
            <h3>
              O que merece sua atenção{" "}
              <span className="count-badge">{alerts.length}</span>
            </h3>
            <p>Observações baseadas nas leituras do intervalo selecionado</p>
          </div>
          <button
            className="text-button"
            onClick={() => navigate("Diagnóstico")}
          >
            Ver diagnóstico <ArrowRight size={14} />
          </button>
        </div>
        {alerts.length ? (
          alerts
            .slice(0, 3)
            .map((o) => <ObservationCard key={o.id} observation={o} compact />)
        ) : (
          <p className="empty-note">
            Nenhum limiar das regras foi atingido neste intervalo. Isso não
            comprova funcionamento perfeito.
          </p>
        )}
      </section>
    </>
  );
}
