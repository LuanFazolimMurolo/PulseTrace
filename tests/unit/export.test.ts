import { describe, expect, it } from "vitest";
import {
  csvCell,
  escapeHtml,
  exportCsv,
  reportHtml,
  reportPdf,
} from "../../src/export/reports";
import { parseFile } from "../../src/import/parser";
import { analyze } from "../../src/analysis/rules";
describe("exportações", () => {
  it("escapa HTML e neutraliza fórmulas de planilha", () => {
    expect(escapeHtml('<script>"&')).toBe("&lt;script&gt;&quot;&amp;");
    expect(csvCell(' =HYPERLINK("x")')).toContain("' =HYPERLINK");
    expect(csvCell("-12")).toBe('"\'-12"');
  });
  it("exporta intervalo, ausências, UTF-8, limites e PDF válido", async () => {
    const s = await parseFile(
      new File(
        [
          "Timestamp,CPU [°C],GPU [°C]\n2026-01-01T12:00:00Z,90,\n2026-01-01T12:00:02Z,91,50",
        ],
        "<img src=x onerror=alert(1)>.csv",
      ),
      { dateOrder: "DMY", utcOffsetMinutes: 0 },
    );
    const range: [number, number] = [s.times[0], s.times[0]];
    const csv = await exportCsv(s, range).text();
    expect(csv).toContain("2026-01-01T12:00:00.000Z");
    expect(csv).not.toContain("12:00:02");
    expect(csv).toContain('"90";""');
    const reimport = await parseFile(new File([csv], "normalizado.csv"), {
      dateOrder: "DMY",
      utcOffsetMinutes: 0,
    });
    expect(reimport.times[0]).toBe(s.times[0]);
    expect(reimport.sensors[0].values[0]).toBe(90);
    expect(reimport.sensors[0].unit).toBe("°C");
    const html = reportHtml(s, analyze(s), range, true);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
    expect(html).toContain("não comprovam defeitos");
    expect(html).not.toContain("<script");
    const pdf = await reportPdf(s, analyze(s), range, true);
    expect((await pdf.text()).startsWith("%PDF")).toBe(true);
  });

  it("gera relatório visual conciso com gráficos e orientações", async () => {
    const entries = Array.from({ length: 40 }, (_, i) =>
      new Date(Date.UTC(2026, 0, 1, 12, 0, i * 2)).toISOString() + "," +
      (i > 0 ? "65" : "60") + "," + (i > 0 ? "86" : "82") + "," + (i > 0 ? "95" : "20"),
    );
    const s = await parseFile(new File([
      "Timestamp,Temperatura GPU [°C],Temperatura de ponto quente da GPU [°C],GPU Potência [W]\\n".replace(/\\n/g, "\n") +
      entries.join("\n"),
    ], "jogo.csv"), { dateOrder: "DMY", utcOffsetMinutes: 0 });
    const range: [number, number] = [s.times[0], s.times[s.times.length - 1]];
    const observations = analyze(s);
    // Hotspot não deve herdar limite crítico genérico da temperatura principal.
    expect(observations.some(o => o.rule === "thermal-sustained" && o.sensor.includes("ponto quente"))).toBe(false);
    const html = reportHtml(s, observations, range, false);
    expect(html).toContain("<svg");
    expect(html).toContain("Por onde começar");
    expect(html).toContain("Medições essenciais");
    expect(html).toContain("não diagnósticos confirmados");
    const pdf = await reportPdf(s, observations, range, false);
    expect((await pdf.text()).startsWith("%PDF")).toBe(true);
  });
  it("preserva temperaturas negativas em exportação e reimportação", async () => {
    const s = await parseFile(
      new File(["Timestamp,CPU [°C]\n2026-01-01T00:00:00Z,-10"], "cold.csv"),
      { dateOrder: "DMY", utcOffsetMinutes: 0 },
    );
    const result = await parseFile(
      new File([exportCsv(s, [s.times[0], s.times[0]])], "roundtrip.csv"),
      { dateOrder: "DMY", utcOffsetMinutes: 0 },
    );
    expect(result.sensors[0].values[0]).toBe(-10);
  });
});
