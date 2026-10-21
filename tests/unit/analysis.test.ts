import { describe, expect, it } from "vitest";
import { parseFile } from "../../src/import/parser";
import { analyze } from "../../src/analysis/rules";
import {
  investigate,
  parseWindowsEvents,
} from "../../src/analysis/investigate";
import { compareSessions } from "../../src/analysis/compare";
async function session(
  values: string[],
  headers = "CPU Package [°C],Core Thermal Throttling [Yes/No]",
  step = 2000,
) {
  const rows = values.map(
    (v, i) => `${new Date(Date.UTC(2026, 0, 1) + i * step).toISOString()},${v}`,
  );
  return parseFile(
    new File([`Timestamp,${headers}\n${rows.join("\n")}`], "test.csv"),
    { dateOrder: "DMY", utcOffsetMinutes: 0 },
  );
}
describe("motor determinístico", () => {
  it("detecta temperatura persistente e limitação explícita com duração", async () => {
    const s = await session(Array.from({ length: 20 }, () => "102,Yes"));
    const results = analyze(s);
    expect(results.find((o) => o.rule === "thermal-sustained")).toMatchObject({
      severity: "critical",
      duration: 38_000,
      confidence: "Moderada",
    });
    expect(results.find((o) => o.rule === "explicit-limit")).toMatchObject({
      confidence: "Alta",
    });
    expect(analyze(s)).toEqual(results);
  });
  it("não chama pico isolado de temperatura persistente", async () => {
    const s = await session(["50,No", "101,No", "51,No"]);
    expect(analyze(s).some((o) => o.rule === "thermal-peak")).toBe(true);
    expect(analyze(s).some((o) => o.rule === "thermal-sustained")).toBe(false);
  });
  it("ausência de amostras interrompe episódios térmicos", async () => {
    const s = await session(
      ["95,No", "95,No", ",No", "95,No", "95,No"],
      undefined,
      10000,
    );
    expect(analyze(s).some((o) => o.rule === "thermal-sustained")).toBe(false);
  });
  it("lacunas interrompem contagem e não provam desligamento", async () => {
    const s = await session(Array.from({ length: 10 }, () => "95,No"));
    s.times[5] += 60_000;
    for (let i = 6; i < s.times.length; i++) s.times[i] += 60_000;
    s.gaps = [{ start: s.times[4], end: s.times[5], duration: 62000 }];
    expect(analyze(s).some((o) => o.rule === "thermal-sustained")).toBe(false);
    expect(analyze(s).find((o) => o.rule === "last-sample")?.severity).toBe(
      "insufficient",
    );
  });
  it("não interpreta uso alto do disco como defeito físico", async () => {
    const s = await session(
      Array.from({ length: 20 }, () => "100"),
      "Drive Activity [%]",
    );
    expect(
      analyze(s).filter(
        (o) => o.severity === "warning" || o.severity === "critical",
      ),
    ).toHaveLength(0);
  });
  it("detecta pressão de memória persistente e variação de potência", async () => {
    const s = await session(
      Array.from({ length: 20 }, (_, i) => `95,${i ? 200 : 30}`),
      "Physical Memory Load [%],GPU Power [W]",
    );
    expect(analyze(s).map((o) => o.rule)).toEqual(
      expect.arrayContaining(["memory-pressure", "power-change"]),
    );
  });
  it("exige carga e identidade explícita para correlação de clock", async () => {
    const s = await session(
      ["4500,90", "1800,95"],
      "CPU Clock (CPU #0) [MHz],CPU Usage (CPU #0) [%]",
    );
    expect(analyze(s).some((o) => o.rule === "clock-drop")).toBe(true);
    const unknown = await session(
      ["4500,90", "1800,95"],
      "CPU Clock [MHz],CPU Usage [%]",
    );
    expect(analyze(unknown).some((o) => o.rule === "clock-drop")).toBe(false);
  });
  it("janela selecionada não herda alerta de outro período", async () => {
    const s = await session(["101,Yes", "40,No", "42,No"]);
    expect(
      analyze(s, undefined, [s.times[1], s.times[2]]).filter(
        (o) => o.severity === "warning",
      ),
    ).toHaveLength(0);
  });
  it("investigação não utiliza amostras futuras", async () => {
    const s = await session(["40,No", "41,No", "101,Yes"]);
    const result = investigate(s, s.times[1]);
    expect(result.count).toBe(2);
    expect(result.lastSample).toBe(s.times[1]);
    expect(result.observations).toHaveLength(0);
    expect(investigate(s, s.times[0] - 1000).lastSample).toBeNull();
  });
  it("não declara normalidade quando a seleção não contém leituras", async () => {
    const s = await session(["40,No", "41,No"]);
    const results = analyze(s, undefined, [s.times[0] + 100, s.times[0] + 200]);
    expect(results.some((o) => o.rule === "insufficient")).toBe(true);
  });
  it("alinha comparações por identidade e nunca preenche ausentes com zero", async () => {
    const a = await session(["40,No", "50,No"]);
    const b = await session(["45", "55"], "CPU Package [°C]");
    expect(compareSessions(a, b)[0].other?.mean).toBe(50);
    expect(compareSessions(a, b)[1].other).toBeNull();
  });
});
describe("eventos Windows", () => {
  it("exige fuso explícito e corrige relógio de forma controlada", () => {
    const e = {
      TimeCreated: "2026-01-01T12:00:00-03:00",
      Id: 41,
      ProviderName: "Kernel-Power",
      Message: "Reinício inesperado",
    };
    expect(parseWindowsEvents(JSON.stringify([e]))[0].time).toBe(
      Date.UTC(2026, 0, 1, 15),
    );
    expect(() =>
      parseWindowsEvents(
        JSON.stringify([{ ...e, TimeCreated: "2026-01-01T12:00:00" }]),
      ),
    ).toThrow("fuso");
    expect(() => parseWindowsEvents("null")).toThrow("inválido");
  });
});
