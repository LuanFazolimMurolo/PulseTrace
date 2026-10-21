import { parseFile } from "./parser";
export async function createDemo() {
  const rows = [
    "Date,Time,CPU Package [°C],CPU Total Usage [%],CPU Core Clock [MHz],CPU Package Power [W],Core Thermal Throttling [Yes/No],GPU Temperature [°C],GPU Hot Spot Temperature [°C],GPU Core Load [%],GPU Power [W],GPU Clock [MHz],GPU Memory Allocated [MB],Physical Memory Load [%],Physical Memory Available [MB],Drive Temperature (NVMe) [°C],Drive Read Rate [MB/s]",
  ];
  const start = Date.UTC(2026, 9, 20, 17, 30);
  for (let i = 0; i < 720; i++) {
    const t = new Date(start + i * 2000 + (i >= 540 ? 24_000 : 0));
    const load = i > 180 && i < 510,
      hot = i >= 390 && i <= 445;
    const wave = Math.sin(i / 13) * 2 + Math.sin(i / 3.8);
    rows.push(
      [
        "20.10.2026",
        t.toISOString().slice(11, 23),
        (hot ? 94 : load ? 73 : 44) + wave,
        load ? 83 + wave : 15 + wave,
        load ? 4700 : 2200,
        load ? 118 + wave * 2 : 32 + wave,
        hot ? "Yes" : "No",
        (load ? 72 : 40) + wave,
        (load ? 88 : 53) + wave,
        load ? 94 : 10,
        load ? 245 + wave * 2 : 34 + wave,
        load ? 2600 : 900,
        load ? 7140 : 1640,
        48 + i / 30 + wave,
        16800 - i * 10,
        42 + wave / 2,
        load ? 120 + wave * 10 : 3,
      ].join(","),
    );
  }
  const session = await parseFile(
    new File([rows.join("\n")], "Sessão de demonstração.csv"),
    { dateOrder: "DMY", utcOffsetMinutes: -180 },
  );
  session.demo = true;
  return session;
}
