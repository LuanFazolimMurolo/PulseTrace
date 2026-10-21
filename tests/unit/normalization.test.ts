import { describe, expect, it } from "vitest";
import { normalizeSensor, parseValue } from "../../src/import/normalize";
describe("normalização conservadora", () => {
  it("preserva unidades não informadas sem inventar Celsius ou watts", () => {
    expect(normalizeSensor("CPU Temperature", 0, 1).unit).toBe("");
    expect(normalizeSensor("GPU Power", 0, 1).unit).toBe("");
  });
  it("distingue porcentagens de limite e flags explícitas", () => {
    const percent = normalizeSensor("GPU Thermal Limit [%]", 0, 1);
    expect(percent.metric).toBe("usage");
    expect(parseValue("85.2", percent)).toBeCloseTo(85.2);
    const flag = normalizeSensor("Thermal Throttling (HTC) [Yes/No]", 0, 1);
    expect(flag.metric).toBe("throttle");
    expect(parseValue("Sim", flag)).toBe(1);
  });
  it("não usa qualificadores de leitura como identidade física", () => {
    expect(normalizeSensor("Core Clocks (avg) [MHz]", 0, 1).device).toBe(
      "Dispositivo não identificado",
    );
    expect(normalizeSensor("CPU Temperature (CPU #0) [°C]", 0, 1).device).toBe(
      "CPU #0",
    );
  });
  it("classifica memória em bytes antes de palavras de utilização", () => {
    expect(normalizeSensor("GPU Memory Usage [MB]", 0, 1).metric).toBe(
      "memory",
    );
    expect(normalizeSensor("Read Activity [%]", 0, 1).component).toBe(
      "Armazenamento",
    );
  });
  it("reconhece flags de saúde sem inferir defeito pela atividade", () => {
    const flag = normalizeSensor("Drive Failure [Yes/No]", 0, 1);
    expect(flag.metric).toBe("health");
    expect(parseValue("No", flag)).toBe(0);
  });
});
