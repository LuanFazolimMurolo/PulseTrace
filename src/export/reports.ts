import type { Observation, Session, TimeRange } from "../core/types";
import { dateTime, duration, number, severityLabel } from "../core/format";
import { stats } from "../analysis/compare";
export const escapeHtml = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function csvCell(v: string) {
  // Prevent spreadsheet formula injection, including leading whitespace/control characters.
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function exportCsv(session: Session, range: TimeRange): Blob {
  const parts: string[] = [
    "\uFEFF",
    [
      "Timestamp",
      ...session.sensors.map(
        (s) =>
          `${s.label} {${s.id}} [${s.unit === "estado" ? "Yes/No" : s.unit}]`,
      ),
    ]
      .map(csvCell)
      .join(";") + "\r\n",
  ];
  for (let i = 0; i < session.times.length; i++) {
    if (session.times[i] < range[0] || session.times[i] > range[1]) continue;
    // Numeric cells come from finite typed values, never from untrusted expressions.
    // Quote negative numbers without an apostrophe so normalized exports can be reimported.
    parts.push(
      [
        csvCell(new Date(session.times[i]).toISOString()),
        ...session.sensors.map(
          (s) => `"${Number.isFinite(s.values[i]) ? String(s.values[i]) : ""}"`,
        ),
      ].join(";") + "\r\n",
    );
  }
  return new Blob(parts, { type: "text/csv;charset=utf-8" });
}
const limitations =
  "Observações de sensores não comprovam defeitos físicos. Ausência de alertas não comprova estabilidade. O fim do CSV não comprova desligamento. Limiares de triagem genéricos devem ser comparados às especificações do fabricante.";
export function reportHtml(
  session: Session,
  observations: Observation[],
  range: TimeRange,
  technical: boolean,
): string {
  const e = escapeHtml;
  const rows = session.sensors
    .map((s) => {
      const st = stats(session, s, range);
      return `<tr><td>${e(s.original)}<small>${e(s.device)} · ${e(s.id)}</small></td><td>${e(number(st.min))}</td><td>${e(number(st.mean))}</td><td>${e(number(st.max))}</td><td>${e(s.unit)}</td><td>${st.count}</td></tr>`;
    })
    .join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>PulseTrace — ${e(session.name)}</title><style>body{font:15px/1.6 system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:24px;color:#17212d;background:#fff}h1{color:#087c71}h2{margin-top:32px}small{display:block;color:#566677}.note,article{border:1px solid #ccd8df;padding:18px;border-radius:12px;margin:14px 0}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #d7e0e5;text-align:left;padding:10px;overflow-wrap:anywhere}.warning{border-left:4px solid #b87500}.critical{border-left:4px solid #c13040}@media print{body{margin:0;padding:0}article,tr{break-inside:avoid}}</style></head><body><h1>PulseTrace / Relatório ${technical ? "técnico" : "simplificado"}</h1><p>${e(session.name)}${session.demo ? " — DEMONSTRAÇÃO COM DADOS SINTÉTICOS" : ""}</p><p>Intervalo: ${e(dateTime(range[0]))} a ${e(dateTime(range[1]))} · ${e(duration(range[1] - range[0]))}<br>Relógio de origem: ${e(session.clock)}. Exibição: ${e(Intl.DateTimeFormat().resolvedOptions().timeZone)}.</p><div class="note">${e(limitations)}</div><h2>Observações fundamentadas</h2>${observations.map((o) => `<article class="${o.severity}"><strong>${e(severityLabel[o.severity])} · ${e(o.title)}</strong><p>Medição: ${e(o.sensor)} · ${e(number(o.value))} ${e(o.unit)} · ${e(dateTime(o.time))}${o.duration !== null ? ` · duração observada: ${e(duration(o.duration))}` : ""}</p><p>${e(o.explanation)}</p><p>Hipóteses (não confirmadas): ${e(o.causes.join("; ") || "Nenhuma causa estabelecida.")}</p><p>Próximas verificações: ${e(o.checks.join("; ") || "Obtenha mais leituras e contexto.")}</p><p>Confiança: ${e(o.confidence)}. ${e(o.limitation)}</p>${technical ? `<small>Regra: ${e(o.rule)} · componente: ${e(o.component)}</small>` : ""}</article>`).join("")}<h2>Medições no intervalo selecionado</h2><table><thead><tr><th>Sensor</th><th>Mín.</th><th>Média</th><th>Máx.</th><th>Unidade</th><th>Válidas</th></tr></thead><tbody>${rows}</tbody></table><h2>Integridade do arquivo completo</h2><p>${session.times.length} leituras aceitas; ${session.quality.invalidTimestamps} timestamps inválidos; ${session.quality.repeatedTimestamps} repetidos; ${session.quality.incompleteRows} linhas incompletas; ${session.quality.skippedRows} descartadas; ${session.quality.invalidValues} valores inválidos; ${session.quality.missingValues} ausentes; ${session.gaps.length} lacunas.</p><p>${session.quality.warnings.map(e).join("<br>")}</p><footer>PulseTrace 0.1.0 · Gerado localmente em ${e(dateTime(Date.now()))} · Nenhum dado enviado.</footer></body></html>`;
}
export async function reportPdf(
  session: Session,
  observations: Observation[],
  range: TimeRange,
  technical: boolean,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 20;
  const write = (text: string, size = 10) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(
      text.replace(/—/g, "-").replace(/→/g, ">"),
      175,
    ) as string[];
    for (const line of lines) {
      if (y > 277) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 17, y);
      y += size * 0.48;
    }
    y += 4;
  };
  write(`PulseTrace / Relatório ${technical ? "técnico" : "simplificado"}`, 20);
  write(session.name + (session.demo ? " - DADOS SINTÉTICOS" : ""), 13);
  write(`${dateTime(range[0])} a ${dateTime(range[1])} | ${session.clock}`);
  write(limitations);
  for (const o of observations) {
    write(`${severityLabel[o.severity]}: ${o.title}`, 12);
    write(
      `Medição: ${o.sensor} | ${number(o.value)} ${o.unit} | ${dateTime(o.time)} | Duração: ${o.duration === null ? "não calculável" : duration(o.duration)}`,
    );
    write(o.explanation);
    write(`Hipóteses: ${o.causes.join("; ") || "Nenhuma causa estabelecida."}`);
    write(`Verificações: ${o.checks.join("; ") || "Obtenha mais dados."}`);
    write(
      `Confiança ${o.confidence}. ${o.limitation}${technical ? ` Regra: ${o.rule}` : ""}`,
    );
  }
  write("Medições no intervalo", 14);
  for (const s of session.sensors) {
    const st = stats(session, s, range);
    write(
      `${s.original}: mín. ${number(st.min)} | média ${number(st.mean)} | máx. ${number(st.max)} ${s.unit} | ${st.count} leituras`,
    );
  }
  write("Integridade do arquivo completo", 14);
  write(
    `${session.times.length} leituras; ${session.quality.invalidTimestamps} timestamps inválidos; ${session.quality.repeatedTimestamps} repetidos; ${session.quality.incompleteRows} linhas incompletas; ${session.quality.skippedRows} descartadas; ${session.quality.invalidValues} valores inválidos; ${session.quality.missingValues} ausentes; ${session.gaps.length} lacunas.`,
  );
  for (const warning of session.quality.warnings) write(warning);
  write(
    `Gerado localmente em ${dateTime(Date.now())}. Horários: ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`,
  );
  return doc.output("blob");
}
