import { useState } from "react";
import type { Session } from "../core/types";
import { compareSessions } from "../analysis/compare";
import { duration, number } from "../core/format";
export function Compare({
  sessions,
  session,
}: {
  sessions: Session[];
  session: Session;
}) {
  const [otherId, setOtherId] = useState(
    sessions.find((s) => s.id !== session.id)?.id ?? "",
  );
  const other = sessions.find((s) => s.id === otherId && s.id !== session.id);
  return (
    <>
      <section className="panel form-panel">
        <h3>Duas sessões, lado a lado</h3>
        <p>
          Compare estatísticas do arquivo completo. Somente sensores com o mesmo
          cabeçalho, grupo, ocorrência e unidade normalizada são alinhados; isso
          não garante que o hardware físico seja o mesmo.
        </p>
        <div className="form-row compact">
          <label>
            Sessão A<input readOnly value={session.name} />
          </label>
          <label>
            Sessão B
            <select
              aria-label="Sessão B"
              value={other?.id ?? ""}
              onChange={(e) => setOtherId(e.target.value)}
            >
              <option value="">Selecione outra sessão</option>
              {sessions
                .filter((s) => s.id !== session.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {sessions.length < 2 && (
          <div className="info-box">
            Importe um segundo CSV para comparar as sessões.
          </div>
        )}
      </section>
      {other && (
        <section className="panel">
          <div className="panel-heading">
            <h3>Comparação de médias e máximas</h3>
            <small>
              A:{" "}
              {duration(
                session.times[session.times.length - 1] - session.times[0],
              )}{" "}
              · B:{" "}
              {duration(other.times[other.times.length - 1] - other.times[0])}
            </small>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sensor</th>
                  <th>Média A</th>
                  <th>Média B</th>
                  <th>Diferença B − A</th>
                  <th>Máx. A / B</th>
                </tr>
              </thead>
              <tbody>
                {compareSessions(session, other).map(
                  ({ sensor: s, other: b }) => (
                    <tr key={s.id}>
                      <td>{s.original}</td>
                      <td>
                        {number(s.mean)} {s.unit}
                      </td>
                      <td>
                        {number(b?.mean)} {b?.unit}
                      </td>
                      <td>
                        {s.mean !== null && b?.mean != null
                          ? `${number(b.mean - s.mean)} ${s.unit}`
                          : "Sem correspondência"}
                      </td>
                      <td>
                        {number(s.max)} / {number(b?.max)} {s.unit}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <p className="empty-note">
            Cargas de trabalho, duração e cadência diferentes afetam esta
            comparação. Ausência de correspondência não representa zero.
          </p>
        </section>
      )}
    </>
  );
}
