import { expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseFile } from "../../src/import/parser";
import { analyze } from "../../src/analysis/rules";

// Opt-in: a public, third-party hardware log is not redistributed with the repository.
const path =
  process.env.PULSETRACE_REAL_CSV ?? "tests/private/hwinfo_report_20240508.csv";
it.skipIf(!existsSync(path))(
  "importa o registro público HWiNFO de 2024-05-08 (validação limitada a este arquivo)",
  async () => {
    const bytes = readFileSync(path);
    const s = await parseFile(new File([bytes], "hwinfo_report_20240508.csv"), {
      dateOrder: "DMY",
      utcOffsetMinutes: 0,
    });
    expect(s.times.length).toBe(123);
    expect(s.sensors.length).toBe(376);
    expect(s.quality.invalidTimestamps).toBe(0);
    expect(s.quality.invalidValues).toBe(0);
    const cpu = s.sensors.find((x) => x.label === "CPU (Tctl/Tdie)");
    expect(cpu?.component).toBe("CPU");
    expect(cpu?.metric).toBe("temperature");
    expect(cpu?.count).toBe(s.times.length);
    expect(
      s.sensors.find((x) => x.label === "GPU Temperature")?.component,
    ).toBe("GPU");
    expect(
      s.sensors.find((x) => x.label === "Physical Memory Load")?.component,
    ).toBe("Memória");
    expect(
      s.sensors.find((x) => x.label === "Drive Temperature")?.component,
    ).toBe("Armazenamento");
    expect(new Set(s.sensors.map((x) => x.identity)).size).toBe(
      s.sensors.length,
    );
    console.log(
      JSON.stringify(
        {
          name: s.name,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          rows: s.times.length,
          sensors: s.sensors.length,
          first: new Date(s.times[0]).toISOString(),
          last: new Date(s.times[s.times.length - 1]).toISOString(),
          cadence: s.cadence,
          quality: s.quality,
          observations: analyze(s).length,
        },
        null,
        2,
      ),
    );
  },
);
