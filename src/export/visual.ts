import type { Observation, Sensor, Session, TimeRange } from "../core/types";
import { dateTime, duration, number, severityLabel } from "../core/format";
import { stats } from "../analysis/compare";
import { guidanceFor, reportHighlights, selectReportSensors } from "../analysis/guidance";
import type { jsPDF } from "jspdf";

const safe = (v: unknown) => String(v).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
);
const note = "Pistas de investigação, não diagnósticos confirmados. O CSV não mede diretamente a qualidade da fonte nem comprova a causa de um desligamento.";
const palette = ["#14b8a6", "#60a5fa", "#fb923c", "#a78bfa"];

/** Original samples only; never interpolate absent values or invent samples. */
export function svgChart(session: Session, sensors: Sensor[], range: TimeRange): string {
  const width = 880, height = 228, left = 52, top = 16, plotW = 806, plotH = 170;
  const values: number[] = [];
  for (const s of sensors) for (let i = 0; i < session.times.length; i++) {
    if (session.times[i] >= range[0] && session.times[i] <= range[1] && Number.isFinite(s.values[i]))
      values.push(s.values[i]);
  }
  if (!values.length) return '<p>Sem leituras para o gráfico selecionado.</p>';
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (hi === lo) { hi += 1; lo -= 1; }
  const gap = (hi - lo) * 0.08;
  lo -= gap; hi += gap;
  const x = (t: number) => left + (t - range[0]) / Math.max(range[1] - range[0], 1) * plotW;
  const y = (v: number) => top + plotH - (v - lo) / (hi - lo) * plotH;
  const lines = sensors.map((s, j) => {
    const segments: string[] = [];
    let part: string[] = [];
    for (let i = 0; i < session.times.length; i++) {
      const t = session.times[i], v = s.values[i];
      if (t < range[0] || t > range[1]) continue;
      if (!Number.isFinite(v)) {
        if (part.length) segments.push(part.join(" "));
        part = [];
        continue;
      }
      // SVG coordinate budget; use sampling for rendering only, never for statistics.
      if (i % Math.max(1, Math.ceil(session.times.length / 500)) !== 0 && i !== session.times.length - 1) continue;
      part.push((part.length ? "L" : "M") + x(t).toFixed(1) + "," + y(v).toFixed(1));
    }
    if (part.length) segments.push(part.join(" "));
    return segments.map(d => '<path d="' + safe(d) + '" fill="none" stroke="' + palette[j % palette.length] + '" stroke-width="2" stroke-linejoin="round"/>').join("");
  }).join("");
  const ticks = [0, .25, .5, .75, 1].map(f => '<line x1="' + left + '" y1="' + (top + plotH * f) + '" x2="' + (left + plotW) + '" y2="' + (top + plotH * f) + '" stroke="#29394c"/><text x="6" y="' + (top + plotH * f + 4) + '" fill="#9baebf" font-size="12">' + safe(number(hi - (hi - lo) * f)) + '</text>').join("");
  const legend = sensors.map((s,j) => '<span><i style="background:' + palette[j % palette.length] + '"></i>' + safe(s.label) + '</span>').join("");
  return '<div class="plot"><div class="legend">' + legend + '</div><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Gráfico das leituras ao longo do tempo"><rect width="' + width + '" height="' + height + '" fill="#111c2b" rx="10"/>' + ticks + lines + '<text x="' + left + '" y="214" fill="#9baebf" font-size="12">' + safe(dateTime(range[0])) + '</text><text x="858" y="214" text-anchor="end" fill="#9baebf" font-size="12">' + safe(dateTime(range[1])) + '</text></svg></div>';
}
export function visualHtml(session: Session, observations: Observation[], range: TimeRange, technical: boolean): string {
  const all = observations.filter(o => o.severity === "critical" || o.severity === "warning");
  const top = all.filter(o => o.rule !== "power-change").concat(all.filter(o => o.rule === "power-change").slice(0, 1));
  const sensors = selectReportSensors(session, range, technical);
  const hs = reportHighlights(session, range);
  const temp = sensors.filter(s => s.metric === "temperature" && s.unit === "°C").slice(0, 3);
  const power = sensors.filter(s => s.metric === "power" && s.unit === "W").slice(0, 2);
  const cards = hs.map(h => '<div class="metric"><span>' + safe(h.label) + '</span><strong>' + safe(number(h.value)) + ' <small>' + safe(h.unit) + '</small></strong></div>').join("");
  const obs = top.map((o, i) => {
    const g = guidanceFor(o);
    return '<article class="finding"><div class="index">' + (i + 1) + '</div><div><div class="tag">' + safe(severityLabel[o.severity]) + ' · ' + safe(g.area) + '</div><h3>' + safe(o.title) + '</h3><p>' + safe(g.meaning) + '</p><p><b>O que pode explicar:</b> ' + safe(g.possibilities.join(" · ")) + '</p><p><b>O que verificar:</b> ' + safe(g.nextSteps.join(" · ")) + '</p><p class="muted">' + safe(g.caution) + '</p>' + (technical ? '<small>Sensor: ' + safe(o.sensor) + ' · ' + safe(dateTime(o.time)) + ' · ' + safe(number(o.value)) + ' ' + safe(o.unit) + '</small>' : '') + '</div></article>';
  }).join("");
  const overview = top.length ? top.length + ' observação(ões) que merecem verificação' : 'Sem alertas nas regras disponíveis';
  const rows = sensors.map(s => {
    const st = stats(session, s, range);
    return '<tr><td>' + safe(s.label) + '</td><td>' + safe(number(st.min)) + '</td><td>' + safe(number(st.mean)) + '</td><td>' + safe(number(st.max)) + '</td><td>' + safe(s.unit) + '</td></tr>';
  }).join("");
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:"><title>PulseTrace | ' + safe(session.name) + '</title><style>' +
    'body{margin:0;background:#0b1220;color:#e7edf5;font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1040px;margin:auto;padding:42px 24px}header{border-bottom:1px solid #304053;padding-bottom:28px;display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}h1{margin:0;font-size:36px;letter-spacing:-1.5px;color:#3fdbc9}h2{font-size:22px;margin:34px 0 16px}h3{margin:5px 0;font-size:18px}p{margin:8px 0}small,.muted,.subtitle{color:#9db0c1}.eyebrow{text-transform:uppercase;color:#3fdbc9;letter-spacing:2px;font-size:11px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:24px 0}.metric,.box,.finding{border:1px solid #2c3a4e;background:#142034;border-radius:14px;padding:19px}.metric span{display:block;color:#afbed0;font-size:12px}.metric strong{display:block;font-size:26px;margin-top:8px}.metric small{font-size:13px}.box{margin:16px 0}.finding{display:flex;gap:15px;margin:12px 0;break-inside:avoid}.index{border-radius:10px;background:#24344a;color:#51e8d5;padding:5px 12px;height:fit-content;font-weight:bold}.tag{font-size:12px;color:#f8c47b}.finding p{font-size:13px}.legend{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:12px;font-size:12px}.legend i{width:12px;height:12px;border-radius:50%;display:inline-block;margin-right:6px}.plot{overflow:hidden;margin:16px 0}.plot svg{display:block;width:100%;height:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:10px;border-bottom:1px solid #2c3a4e}footer{padding-top:22px;margin-top:30px;border-top:1px solid #2c3a4e;color:#9db0c1;font-size:12px}@media print{body{background:white;color:#142034}.box,.metric,.finding{background:#f5f8fc;color:#142034;border-color:#dbe3eb}main{padding:8px}.finding,.box,.plot{break-inside:avoid}}' +
    '</style></head><body><main><header><div><div class="eyebrow">Relatório de diagnóstico</div><h1>PulseTrace</h1><p class="subtitle">' + safe(session.name) + (session.demo ? ' · DADOS SINTÉTICOS' : '') + '</p></div><div class="subtitle">Intervalo analisado<br>' + safe(dateTime(range[0])) + '<br>até ' + safe(dateTime(range[1])) + '<br>' + safe(duration(range[1] - range[0])) + '</div></header><div class="grid">' + cards + '</div><div class="box"><strong>Visão geral:</strong> ' + safe(overview) + '<p>' + safe(note) + '</p></div><h2>Por onde começar</h2>' + (obs || '<div class="box">Nenhuma regra gerou alerta neste intervalo. Isso não garante ausência de falha. Correlacione o horário com os eventos do Windows.</div>') + '<h2>Gráficos principais</h2>' + (temp.length ? '<div class="box"><h3>Temperaturas (°C)</h3>' + svgChart(session, temp, range) + '</div>' : '') + (power.length ? '<div class="box"><h3>Consumo informado (W)</h3>' + svgChart(session, power, range) + '</div>' : '') + '<h2>' + (technical ? 'Medições técnicas' : 'Medições essenciais') + '</h2><div class="box"><table><thead><tr><th>Sensor</th><th>Mín.</th><th>Média</th><th>Máx.</th><th>Unidade</th></tr></thead><tbody>' + rows + '</tbody></table></div><footer>' + safe(session.times.length) + ' amostras no CSV completo · relógio de origem: ' + safe(session.clock) + ' · análise local · nenhum dado enviado. ' + safe(dateTime(Date.now())) + '</footer></main></body></html>';
}

export function visualPdf(doc: jsPDF, session: Session, observations: Observation[], range: TimeRange, technical: boolean): void {
  const sensors = selectReportSensors(session, range, technical);
  const alerts = observations.filter(o => o.severity === "critical" || o.severity === "warning");
  const top = alerts.filter(o => o.rule !== "power-change").concat(alerts.filter(o => o.rule === "power-change").slice(0, 1));
  let y = 22;
  const page = () => { doc.addPage(); y = 22; };
  const write = (value: string, size = 10, color: [number,number,number] = [30, 48, 67]) => {
    doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(value.replace(/[→—]/g, "-"), 174) as string[];
    for (const line of lines) { if (y > 270) page(); doc.text(line, 18, y); y += size * .52; }
    y += 4;
  };
  doc.setFillColor(13, 29, 49); doc.rect(0, 0, 210, 51, "F");
  doc.setTextColor(45, 212, 191); doc.setFontSize(24); doc.text("PulseTrace", 18, 25);
  doc.setTextColor(223, 238, 250); doc.setFontSize(10); doc.text("Diagnóstico orientado por evidências", 18, 37);
  y = 61;
  write(session.name + (session.demo ? " - DADOS SINTÉTICOS" : ""), 13);
  write(dateTime(range[0]) + " a " + dateTime(range[1]) + " | " + duration(range[1] - range[0]));
  write(note, 9, [100, 113, 127]);
  write("Resumo das medições", 15);
  for (const h of reportHighlights(session, range)) write(h.label + ": " + number(h.value) + " " + h.unit, 11);
  write("Caminho de investigação", 15);
  if (!top.length) write("Sem alertas pelas regras disponíveis. Não comprova estabilidade.");
  for (const o of top) {
    const g = guidanceFor(o);
    write(severityLabel[o.severity] + " | " + g.area + " | " + o.title, 12, [18, 133, 122]);
    write("Observado: " + g.meaning);
    write("Possibilidades: " + g.possibilities.join("; "));
    write("Verificar: " + g.nextSteps.join("; "));
    write("Ressalva: " + g.caution, 9, [95, 108, 122]);
    if (technical) write("Sensor: " + o.sensor + " | " + dateTime(o.time) + " | " + number(o.value) + " " + o.unit, 9);
  }
  write("Tendências registradas", 15);
  for (const group of [
    sensors.filter(s => s.metric === "temperature" && s.unit === "°C").slice(0, 2),
    sensors.filter(s => s.metric === "power" && s.unit === "W").slice(0, 2),
  ]) {
    if (!group.length) continue;
    if (y > 215) page();
    const points: number[] = [];
    for (const s of group) for (let i = 0; i < session.times.length; i++) if (session.times[i] >= range[0] && session.times[i] <= range[1] && Number.isFinite(s.values[i])) points.push(s.values[i]);
    if (!points.length) continue;
    let lo = Infinity, hi = -Infinity;
    for (const v of points) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (hi === lo) { lo -= 1; hi += 1; }
    const chartY = y + 4, chartH = 36, chartX = 18, chartW = 174;
    doc.setDrawColor(210, 221, 230); doc.rect(chartX, chartY, chartW, chartH);
    group.forEach((s, j) => {
      const col: [number,number,number] = j ? [67, 120, 210] : [20, 160, 142];
      doc.setDrawColor(...col);
      let prev: [number, number] | null = null;
      const step = Math.max(1, Math.ceil(session.times.length / 350));
      for (let i = 0; i < session.times.length; i += step) {
        const t = session.times[i], v = s.values[i];
        if (t < range[0] || t > range[1] || !Number.isFinite(v)) { prev = null; continue; }
        const pt: [number,number] = [chartX + (t - range[0]) / Math.max(1, range[1] - range[0]) * chartW, chartY + chartH - (v - lo) / (hi - lo) * chartH];
        if (prev) doc.line(prev[0], prev[1], pt[0], pt[1]);
        prev = pt;
      }
    });
    y = chartY + chartH + 7;
    write(group.map(s => s.label).join(" / ") + " | " + group[0].unit, 9);
  }
  write(technical ? "Sensores no intervalo (técnico)" : "Sensores essenciais no intervalo", 14);
  for (const s of sensors) {
    const st = stats(session, s, range);
    write(s.label + ": mín " + number(st.min) + ", média " + number(st.mean) + ", máx " + number(st.max) + " " + s.unit, 9);
  }
  write("Gerado localmente em " + dateTime(Date.now()) + ". Nenhum dado enviado.", 8, [100,113,127]);
}
