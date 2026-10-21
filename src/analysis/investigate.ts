import type { Session, WindowsEvent } from "../core/types";
import { analyze } from "./rules";
export function investigate(
  session: Session,
  failureTime: number,
  minutes = 5,
  events: WindowsEvent[] = [],
  clockCorrectionSeconds = 0,
) {
  if (!Number.isFinite(failureTime))
    throw new Error("Informe uma data e um horário válidos.");
  const start = failureTime - minutes * 60_000;
  let lastIndex = -1,
    count = 0;
  session.times.forEach((t, i) => {
    if (t <= failureTime) lastIndex = i;
    if (t >= start && t <= failureTime) count++;
  });
  return {
    start,
    end: failureTime,
    count,
    lastSample: lastIndex >= 0 ? session.times[lastIndex] : null,
    observations: analyze(session, undefined, [start, failureTime]).filter(
      (o) => o.rule !== "last-sample" && o.time <= failureTime,
    ),
    gaps: session.gaps.filter((g) => g.start <= failureTime && g.end >= start),
    events: events
      .map((e) => ({ ...e, time: e.time + clockCorrectionSeconds * 1000 }))
      .filter((e) => e.time >= start && e.time <= failureTime + 60_000),
  };
}

export function parseWindowsEvents(text: string): WindowsEvent[] {
  if (text.length > 5 * 1024 * 1024)
    throw new Error("Eventos: limite de 5 MiB excedido.");
  const raw: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
  const list = Array.isArray(raw) ? raw : [raw];
  if (list.length > 10_000)
    throw new Error("Eventos: limite de 10.000 entradas excedido.");
  return list
    .map((entry: unknown) => {
      if (!entry || typeof entry !== "object")
        throw new Error("Evento inválido.");
      const row = entry as Record<string, unknown>;
      if (
        typeof row.TimeCreated !== "string" ||
        !/(?:Z|[+-]\d{2}:\d{2})$/i.test(row.TimeCreated)
      )
        throw new Error(
          "TimeCreated deve usar ISO 8601 com fuso explícito (Z ou ±HH:MM).",
        );
      const time = Date.parse(row.TimeCreated);
      if (
        !Number.isFinite(time) ||
        !Number.isInteger(row.Id) ||
        typeof row.ProviderName !== "string" ||
        typeof row.Message !== "string"
      )
        throw new Error(
          "Evento sem TimeCreated, Id, ProviderName ou Message válidos.",
        );
      return {
        time,
        id: row.Id as number,
        provider: row.ProviderName.slice(0, 256),
        message: row.Message.slice(0, 8192),
      };
    })
    .sort((a, b) => a.time - b.time);
}
