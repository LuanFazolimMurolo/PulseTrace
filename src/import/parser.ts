import {
  LIMITS,
  type ImportOptions,
  type Quality,
  type Session,
} from "../core/types";
import { CsvReader, detectDelimiter, detectEncoding } from "./csv";
import { fold, normalizeSensor, parseValue } from "./normalize";
import { parseTimestamp } from "./timestamp";

export async function parseFile(
  file: Blob & { name?: string },
  options: ImportOptions,
  progress: (percent: number) => void = () => {},
): Promise<Session> {
  if (!file.size)
    throw new Error(
      "O arquivo está vazio. Inicie o registro de sensores no HWiNFO64.",
    );
  if (file.size > LIMITS.fileBytes)
    throw new Error(
      "O arquivo excede 64 MiB. Divida o registro em sessões menores.",
    );
  if (
    !Number.isInteger(options.utcOffsetMinutes) ||
    Math.abs(options.utcOffsetMinutes) > 840
  )
    throw new Error("Fuso horário inválido.");
  const sample = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const encoding = detectEncoding(sample);
  const delimiter = detectDelimiter(new TextDecoder(encoding).decode(sample));
  const quality: Quality = {
    encoding,
    delimiter,
    totalRows: 0,
    invalidTimestamps: 0,
    repeatedTimestamps: 0,
    outOfOrder: 0,
    incompleteRows: 0,
    invalidValues: 0,
    missingValues: 0,
    skippedRows: 0,
    warnings: [],
  };
  let headers: string[] = [],
    dateIndex = -1,
    timeIndex = -1,
    stampIndex = -1;
  let sensors: Session["sensors"] = [],
    indices: number[] = [];
  const times: number[] = [],
    values: number[][] = [],
    seen = new Set<number>();
  const reader = new CsvReader(delimiter, (row, malformed) => {
    if (row.every((v) => !v.trim())) return;
    if (!headers.length) {
      if (malformed) throw new Error("Cabeçalho CSV malformado.");
      headers = row.map((v) => v.replace(/^\uFEFF/, "").trim());
      dateIndex = headers.findIndex((v) =>
        /^(date|data|datum|fecha)$/.test(fold(v)),
      );
      timeIndex = headers.findIndex((v) =>
        /^(time|hora|horario|zeit)$/.test(fold(v)),
      );
      stampIndex = headers.findIndex((v) =>
        /^(timestamp|datetime|date.?time|data.?hora)$/.test(fold(v)),
      );
      if (stampIndex < 0 && (dateIndex < 0 || timeIndex < 0))
        throw new Error(
          "Não encontrei colunas de data e hora. Exporte um registro de sensores, não um relatório do HWiNFO64.",
        );
      const occurrences = new Map<string, number>();
      let group = "";
      headers.forEach((header, i) => {
        if ([dateIndex, timeIndex, stampIndex].includes(i)) return;
        if (!header) return;
        // HWiNFO section columns do not have units; their following values are blank.
        if (/^\[.+\]$/.test(header)) {
          group = header.slice(1, -1);
          return;
        }
        const key = `${group}|${header}`;
        const n = (occurrences.get(key) ?? 0) + 1;
        occurrences.set(key, n);
        sensors.push(normalizeSensor(header, i, n, group));
        indices.push(i);
        values.push([]);
      });
      if (!sensors.length)
        throw new Error("O CSV não contém colunas de sensores.");
      if ([...occurrences.values()].some((n) => n > 1))
        quality.warnings.push(
          "Nomes duplicados preservados por coluna e ocorrência; a identidade física não pode ser inferida sem o dispositivo no cabeçalho.",
        );
      return;
    }
    if (++quality.totalRows > LIMITS.rows)
      throw new Error("Limite de 1 milhão de linhas excedido.");
    if (
      row[dateIndex] === headers[dateIndex] &&
      row[timeIndex] === headers[timeIndex] &&
      (stampIndex < 0 || row[stampIndex] === headers[stampIndex])
    ) {
      quality.skippedRows++;
      return;
    }
    if (malformed || row.length > headers.length) {
      quality.skippedRows++;
      return;
    }
    if (row.length < headers.length) quality.incompleteRows++;
    const stamp = parseTimestamp(
      stampIndex >= 0 ? (row[stampIndex] ?? "") : (row[dateIndex] ?? ""),
      stampIndex >= 0 ? "" : (row[timeIndex] ?? ""),
      options,
    );
    if (!Number.isFinite(stamp)) {
      quality.invalidTimestamps++;
      return;
    }
    if ((times.length + 1) * sensors.length > LIMITS.cells)
      throw new Error(
        "Limite de 6 milhões de valores excedido. Divida o arquivo em sessões menores.",
      );
    if (seen.has(stamp)) quality.repeatedTimestamps++;
    if (times.length && stamp < times[times.length - 1]) quality.outOfOrder++;
    seen.add(stamp);
    times.push(stamp);
    sensors.forEach((sensor, s) => {
      const raw = row[indices[s]];
      const value = parseValue(raw, sensor);
      if (!Number.isFinite(value)) {
        if (raw == null || /^(?:|n\/a|na|nan|null|--|-)$/i.test(raw.trim()))
          quality.missingValues++;
        else quality.invalidValues++;
      }
      values[s].push(value);
    });
  });
  const decoder = new TextDecoder(encoding);
  const chunkSize = 256 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    reader.feed(
      decoder.decode(
        await file.slice(offset, offset + chunkSize).arrayBuffer(),
        { stream: true },
      ),
    );
    progress(Math.min(95, Math.round(((offset + chunkSize) / file.size) * 95)));
  }
  reader.feed(decoder.decode());
  reader.finish();
  if (!times.length)
    throw new Error(
      "Nenhuma leitura com data e hora válidas. Confira o formato de data nas opções de importação.",
    );
  const order = quality.outOfOrder
    ? times.map((_, i) => i).sort((a, b) => times[a] - times[b])
    : null;
  const sorted = Float64Array.from(order ? order.map((i) => times[i]) : times);
  sensors = sensors.map((sensor, s) => {
    const data = order
      ? Float32Array.from(order, (i) => values[s][i])
      : Float32Array.from(values[s]);
    let min = Infinity,
      max = -Infinity,
      sum = 0,
      count = 0;
    for (const value of data)
      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
        sum += value;
        count++;
      }
    return {
      ...sensor,
      values: data,
      min: count ? min : null,
      max: count ? max : null,
      mean: count ? sum / count : null,
      count,
    };
  });
  const diffs: number[] = [];
  for (let i = 1; i < sorted.length; i++)
    if (sorted[i] > sorted[i - 1]) diffs.push(sorted[i] - sorted[i - 1]);
  diffs.sort((a, b) => a - b);
  const cadence = diffs.length ? diffs[Math.floor(diffs.length / 2)] : 0;
  const gaps: Session["gaps"] = [];
  for (let i = 1; i < sorted.length; i++)
    if (cadence > 0 && sorted[i] - sorted[i - 1] > Math.max(cadence * 3, 5000))
      gaps.push({
        start: sorted[i - 1],
        end: sorted[i],
        duration: sorted[i] - sorted[i - 1],
      });
  if (encoding === "windows-1252")
    quality.warnings.push(
      "Codificação estimada como Windows-1252. Confira os nomes dos sensores.",
    );
  quality.warnings.push(
    "Datas sem fuso usam o deslocamento informado na importação. Horários da interface usam o fuso deste computador.",
  );
  if (sensors.some((s) => s.device === "Dispositivo não identificado"))
    quality.warnings.push(
      "Alguns sensores não informam o dispositivo. Correlações que exigem identidade explícita foram desativadas para eles.",
    );
  progress(100);
  return {
    id: crypto.randomUUID(),
    name: file.name ?? "registro.csv",
    size: file.size,
    demo: false,
    times: sorted,
    sensors,
    quality,
    gaps,
    cadence,
    clock: `UTC${options.utcOffsetMinutes >= 0 ? "+" : ""}${options.utcOffsetMinutes / 60} · ${options.dateOrder}`,
    importedAt: Date.now(),
  };
}
