import type { Component, Metric, Sensor } from "../core/types";

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const units = /\[([^\]]*)\]\s*$/;

export function normalizeSensor(
  header: string,
  index: number,
  occurrence: number,
  group = "",
): Sensor {
  const original = header.trim();
  const sourceUnit = original.match(units)?.[1]?.trim() ?? "";
  const label = original.replace(units, "").trim() || `Sensor ${index + 1}`;
  const text = fold(`${group} ${label}`);
  // Explicit device suffixes/prefixes are preserved. Unknown identities stay unknown.
  const device =
    group ||
    label.match(
      /\(((?:CPU|GPU|Drive|Disk|NVMe|SSD|HDD|NVIDIA|GeForce|Radeon|Intel|AMD)\s*[^)]*)\)/i,
    )?.[1] ||
    label.match(/^((?:CPU|GPU|Drive|Disk)\s*#?\d+[^:]*):\s*/i)?.[1] ||
    "Dispositivo não identificado";
  let component: Component = "Sistema";
  if (/gpu|geforce|radeon|nvidia|intel.*graphics/.test(text)) component = "GPU";
  else if (
    /drive|disk|disco|ssd|hdd|nvme|sata|smart|(?:read|write|total) activity|read rate|write rate|leitura|gravacao/.test(
      text,
    )
  )
    component = "Armazenamento";
  else if (
    /physical memory|virtual memory|memoria fisica|memoria virtual|committed|commit charge|page file|ram\b/.test(
      text,
    )
  )
    component = "Memória";
  else if (
    /cpu|core|nucleo|processor|processador|package|tctl|tdie|prochot|throttling.*htc/.test(
      text,
    )
  )
    component = "CPU";
  let metric: Metric = "other";
  const u = fold(sourceUnit).replace(/\s/g, "");
  if (
    /drive failure|drive warning|falha.*disco|alerta.*disco/.test(text) &&
    /yes|no|sim|nao/.test(u)
  )
    metric = "health";
  else if (
    /throttl|thermal limit|performance limit|limitacao.*term|limite.*term/.test(
      text,
    ) &&
    u !== "%"
  )
    metric = "throttle";
  else if (
    /°[cf]|^c$|^f$|^k$/.test(u) ||
    /temperature|temperatura|hot.?spot|tctl|tdie/.test(text)
  )
    metric = "temperature";
  else if (/^[gmk]?hz$/.test(u) || /clock|frequencia/.test(text))
    metric = "clock";
  else if (/^(m?w|kw)$/.test(u) || /power|potencia/.test(text))
    metric = "power";
  else if (
    /^%$/.test(u) &&
    /health|saude|remaining life|vida restante/.test(text)
  )
    metric = "health";
  else if (/^[kmgt]?i?b\/s$/.test(u)) metric = "rate";
  else if (/^[kmgt]?i?b$/.test(u)) metric = "memory";
  else if (u === "%" || /usage|utilization|utilizacao|load|carga/.test(text))
    metric = "usage";
  else if (/latency|latencia/.test(text)) metric = "latency";
  const unit =
    metric === "temperature" && /^(°?[cf]|k)$/.test(u)
      ? "°C"
      : metric === "clock" && /^[gmk]?hz$/.test(u)
        ? "MHz"
        : metric === "power" && /^(m?w|kw)$/.test(u)
          ? "W"
          : metric === "throttle" || /^(yes\/no|sim\/nao)$/.test(u)
            ? "estado"
            : sourceUnit;
  return {
    id: `sensor-${index}`,
    identity: `${fold(group)}|${fold(original)}|${occurrence}`,
    label,
    original,
    device,
    component,
    metric,
    unit,
    sourceUnit,
    values: new Float32Array(),
    min: null,
    max: null,
    mean: null,
    count: 0,
  };
}

export function parseValue(raw: string | undefined, sensor: Sensor): number {
  if (raw == null || /^(?:|n\/a|na|nan|null|--|-)$/i.test(raw.trim()))
    return NaN;
  const text = fold(raw).replace(/\s/g, "");
  if (sensor.unit === "estado") {
    if (/^(yes|sim|true|active|ativo|1)$/.test(text)) return 1;
    if (/^(no|nao|false|inactive|inativo|0)$/.test(text)) return 0;
    return NaN;
  }
  // No eval, expressions or permissive parseFloat: a cell is numeric or missing.
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(text))
    return NaN;
  let value = Number(text.replace(",", "."));
  const u = fold(sensor.sourceUnit);
  if (sensor.metric === "temperature") {
    if (/f/.test(u)) value = ((value - 32) * 5) / 9;
    if (u === "k") value -= 273.15;
  } else if (sensor.metric === "clock") {
    if (u === "ghz") value *= 1000;
    if (u === "khz") value /= 1000;
    if (u === "hz") value /= 1_000_000;
  } else if (sensor.metric === "power") {
    if (u === "mw") value /= 1000;
    if (u === "kw") value *= 1000;
  }
  if (!Number.isFinite(value) || Math.abs(value) > 3.4e38) return NaN;
  if (sensor.metric === "temperature" && (value < -273.15 || value > 1000))
    return NaN;
  if (
    ["usage", "health"].includes(sensor.metric) &&
    sensor.unit === "%" &&
    value < 0
  )
    return NaN;
  if (
    ["clock", "power", "memory", "rate", "latency"].includes(sensor.metric) &&
    value < 0
  )
    return NaN;
  return value;
}
