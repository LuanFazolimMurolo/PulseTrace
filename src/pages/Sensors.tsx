import { useState } from "react";
import type { Component } from "../core/types";
import { number } from "../core/format";
import { stats } from "../analysis/compare";
import { Chart } from "../components/Chart";
import type { PageProps } from "./Dashboard";
export function Sensors({
  component,
  ...props
}: PageProps & { component: Component }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const sensors = props.session.sensors.filter(
    (s) => s.component === component,
  );
  const groups = new Map<string, typeof sensors>();
  for (const sensor of sensors) {
    const key = `${sensor.metric}|${sensor.unit}`;
    groups.set(key, [...(groups.get(key) ?? []), sensor]);
  }
  const names: Record<string, string> = {
    temperature: "Temperatura",
    usage: "Utilização",
    clock: "Frequência",
    power: "Potência",
    throttle: "Indicadores de limitação",
    memory: "Memória",
    rate: "Taxa de transferência",
    latency: "Latência",
    health: "Indicador de saúde registrado",
    other: "Outros sensores",
  };
  return (
    <>
      <p className="page-note">
        Somente sensores presentes no arquivo. Use as caixas da tabela para
        escolher séries (até 6 por gráfico). Valores ausentes não são
        interpolados.
      </p>
      <div className="sensor-charts">
        {[...groups].map(([key, list]) => (
          <Chart
            key={key}
            {...props}
            title={names[list[0].metric]}
            subtitle={`${list.length} sensor(es) disponíveis · ${list[0].unit || "unidade não informada"}`}
            sensors={(selected.length
              ? list.filter((s) => selected.includes(s.id))
              : list
            ).slice(0, 6)}
          />
        ))}
      </div>
      {!sensors.length && (
        <div className="panel empty-state">
          <h3>Sem sensores de {component}</h3>
          <p>
            O CSV não contém sensores reconhecidos deste componente. Confira
            também a página Sistema para nomes não reconhecidos.
          </p>
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h3>Leituras por sensor</h3>
          <input
            aria-label="Buscar sensor"
            placeholder="Buscar sensor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sensor</th>
                <th>Dispositivo</th>
                <th>Mínima</th>
                <th>Média</th>
                <th>Máxima</th>
                <th>Válidas</th>
              </tr>
            </thead>
            <tbody>
              {sensors
                .filter((s) =>
                  s.original.toLowerCase().includes(search.toLowerCase()),
                )
                .map((s) => {
                  const st = stats(props.session, s, props.range);
                  return (
                    <tr key={s.id}>
                      <td>
                        <label className="sensor-check">
                          <input
                            type="checkbox"
                            checked={selected.includes(s.id)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, s.id]
                                  : selected.filter((id) => id !== s.id),
                              )
                            }
                          />
                          <span>
                            {s.original}
                            <small>{s.id}</small>
                          </span>
                        </label>
                      </td>
                      <td>{s.device}</td>
                      <td>
                        {number(st.min)} {s.unit}
                      </td>
                      <td>
                        {number(st.mean)} {s.unit}
                      </td>
                      <td>
                        {number(st.max)} {s.unit}
                      </td>
                      <td>{st.count}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
