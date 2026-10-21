import { describe, expect, it } from "vitest";
import { parseFile } from "../../src/import/parser";
import { CsvReader, detectEncoding } from "../../src/import/csv";
import { parseTimestamp } from "../../src/import/timestamp";
import { LIMITS } from "../../src/core/types";
const options = { dateOrder: "DMY" as const, utcOffsetMinutes: -180 };
const parse = (text: string) =>
  parseFile(new File([text], "test.csv"), options);

describe("importação CSV", () => {
  it("encontra colunas fora de posições fixas e converte unidades", async () => {
    const s = await parse(
      "CPU Clock [GHz];Hora;CPU Package [°F];Data;CPU Power [mW]\n4,2;12:00:00;212;20/10/2026;65000\n4,3;12:00:02;194;20/10/2026;70000",
    );
    expect(s.times[0]).toBe(Date.UTC(2026, 9, 20, 15));
    expect(s.sensors[0].values[0]).toBe(4200);
    expect(s.sensors[1].values[0]).toBe(100);
    expect(s.sensors[2].values[0]).toBe(65);
    expect(s.cadence).toBe(2000);
  });
  it("rejeita vazio e cabeçalho sem timestamps", async () => {
    await expect(parse("")).rejects.toThrow("vazio");
    await expect(parse("Sensor,Value\nCPU,10")).rejects.toThrow("data e hora");
    await expect(parse("Date,Time,CPU [°C]")).rejects.toThrow(
      "Nenhuma leitura",
    );
  });
  it("mantém cabeçalhos duplicados e grupos de dispositivo", async () => {
    const s = await parse(
      "Date,Time,[GPU #0],Temperature [°C],Temperature [°C],[GPU #1],Temperature [°C]\n20.10.2026,12:00:00,,70,71,,80",
    );
    expect(new Set(s.sensors.map((x) => x.id)).size).toBe(3);
    expect(new Set(s.sensors.map((x) => x.identity)).size).toBe(3);
    expect(s.sensors.map((x) => x.device)).toEqual([
      "GPU #0",
      "GPU #0",
      "GPU #1",
    ]);
    expect(s.sensors.every((x) => x.component === "GPU")).toBe(true);
  });
  it("não inventa valores ausentes nem aceita expressões", async () => {
    const s = await parse(
      "Date,Time,CPU Package [°C],GPU Power [W]\n20.10.2026,12:00:00,50,\n20.10.2026,12:00:02,=1+2\n20.10.2026,12:00:04,NaN,-3",
    );
    expect(s.sensors[0].count).toBe(1);
    expect(s.sensors[1].count).toBe(0);
    expect(s.quality.incompleteRows).toBe(1);
    expect(s.quality.invalidValues).toBe(2);
  });
  it("descarta registro truncado com aspas abertas e linhas excessivas", async () => {
    const s = await parse(
      'Date,Time,CPU [°C]\n20.10.2026,12:00:00,50\n20.10.2026,12:00:02,52,extra\n20.10.2026,12:00:04,"58',
    );
    expect(s.times.length).toBe(1);
    expect(s.quality.skippedRows).toBe(2);
  });
  it("contabiliza inválidos, duplicados, ordem e cabeçalhos repetidos", async () => {
    const s = await parse(
      "Date,Time,CPU [°C]\n20.10.2026,12:00:02,52\n20.10.2026,12:00:00,50\n20.10.2026,12:00:00,51\nDate,Time,CPU [°C]\n31.02.2026,12:00:04,55",
    );
    expect(s.quality.outOfOrder).toBe(1);
    expect(s.quality.repeatedTimestamps).toBe(1);
    expect(s.quality.invalidTimestamps).toBe(1);
    expect(s.quality.skippedRows).toBe(1);
    expect([...s.sensors[0].values]).toEqual([50, 51, 52]);
  });
  it("detecta UTF-16 e Windows-1252", async () => {
    const text = "Date\tTime\tCPU [°C]\n20.10.2026\t12:00:00\t80";
    const utf16 = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(text, "utf16le"),
    ]);
    const s = await parseFile(new File([utf16], "utf16.csv"), options);
    expect(s.quality.encoding).toBe("utf-16le");
    expect(s.sensors[0].values[0]).toBe(80);
    expect(
      detectEncoding(Uint8Array.from([0x43, 0x50, 0x55, 0x20, 0xb0, 0x43])),
    ).toBe("windows-1252");
  });
  it("trata aspas, delimitadores e quebras entre blocos", () => {
    const rows: string[][] = [];
    const reader = new CsvReader(",", (row) => rows.push(row));
    for (const c of '"a,b","c""d"\r\n"e\nf",g') reader.feed(c);
    reader.finish();
    expect(rows).toEqual([
      ["a,b", 'c"d'],
      ["e\nf", "g"],
    ]);
  });
  it("rejeita campos e arquivos além dos limites", async () => {
    const blob = { size: LIMITS.fileBytes + 1 } as Blob;
    await expect(parseFile(blob, options)).rejects.toThrow("64 MiB");
    await expect(
      parse("Date,Time," + "X".repeat(LIMITS.fieldChars + 1)),
    ).rejects.toThrow("campo");
    await expect(
      parse(
        "Date,Time," +
          Array.from({ length: LIMITS.columns }, (_, i) => `S${i}`).join(","),
      ),
    ).rejects.toThrow("colunas");
  });
  it("processa 100 mil linhas sem reduzir os dados originais", async () => {
    const rows = ["Timestamp,CPU [°C],GPU [°C]"];
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 100_000; i++)
      rows.push(
        `${new Date(start + i * 2000).toISOString()},${40 + (i % 50)},65`,
      );
    const progress: number[] = [];
    const s = await parseFile(
      new File([rows.join("\n")], "large.csv"),
      options,
      (p) => progress.push(p),
    );
    expect(s.times.length).toBe(100_000);
    expect(s.sensors[0].max).toBe(89);
    expect(s.gaps.length).toBe(0);
    expect(progress.at(-1)).toBe(100);
  }, 20_000);
});

describe("horários", () => {
  it.each([
    "20.10.2026 12:00:00.123",
    "20/10/2026 12:00:00,123",
    "2026-10-20T12:00:00.123-03:00",
    "20-10-26 12:00:00.123 PM",
  ])("interpreta %s", (value) => {
    expect(parseTimestamp(value, "", options)).toBe(
      Date.UTC(2026, 9, 20, 15, 0, 0, 123),
    );
  });
  it("respeita MDY, UTC e rejeita datas impossíveis", () => {
    expect(
      parseTimestamp("10/20/2026", "12:00:00", {
        ...options,
        dateOrder: "MDY",
      }),
    ).toBe(Date.UTC(2026, 9, 20, 15));
    expect(parseTimestamp("2026-10-20T12:00:00Z", "", options)).toBe(
      Date.UTC(2026, 9, 20, 12),
    );
    expect(parseTimestamp("8.5.2024", "19:31:1.643", options)).toBe(
      Date.UTC(2024, 4, 8, 22, 31, 1, 643),
    );
    for (const value of [
      "31/02/2026 10:00",
      "20/10/2026 25:00",
      "20/10/2026 00:00 PM",
      "2026-10-20T12:00+15:00",
    ])
      expect(parseTimestamp(value, "", options)).toBeNaN();
  });
});
