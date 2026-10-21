import { LIMITS } from "../core/types";

/** Incremental RFC4180-style tokenizer. Memory bounded per field and per record. */
export class CsvReader {
  private field = "";
  private row: string[] = [];
  private quoted = false;
  private quotePending = false;
  private afterQuote = false;
  private cr = false;
  private chars = 0;
  constructor(
    private delimiter: string,
    private emit: (row: string[], malformed: boolean) => void,
  ) {}
  private malformed = false;
  private pushField() {
    this.row.push(this.field);
    this.field = "";
    this.afterQuote = false;
    if (this.row.length > LIMITS.columns)
      throw new Error(`Limite de ${LIMITS.columns} colunas excedido.`);
  }
  private pushRow() {
    this.pushField();
    this.emit(this.row, this.malformed);
    this.row = [];
    this.chars = 0;
    this.malformed = false;
  }
  feed(chunk: string) {
    for (const c of chunk) {
      if (++this.chars > LIMITS.rowChars)
        throw new Error("Uma linha excede o limite de 1 MiB.");
      if (this.cr) {
        this.cr = false;
        if (c === "\n") continue;
      }
      if (this.quotePending) {
        this.quotePending = false;
        if (c === '"') {
          this.field += '"';
          if (this.field.length > LIMITS.fieldChars)
            throw new Error("Um campo excede o limite de 16.384 caracteres.");
          continue;
        }
        this.quoted = false;
        this.afterQuote = true;
      }
      if (this.quoted) {
        if (c === '"') this.quotePending = true;
        else this.field += c;
      } else if (c === this.delimiter) this.pushField();
      else if (c === "\n" || c === "\r") {
        this.pushRow();
        this.cr = c === "\r";
      } else if (c === '"' && this.field.length === 0 && !this.afterQuote)
        this.quoted = true;
      else {
        if (this.afterQuote && c.trim()) this.malformed = true;
        this.field += c;
      }
      if (this.field.length > LIMITS.fieldChars)
        throw new Error("Um campo excede o limite de 16.384 caracteres.");
    }
  }
  finish() {
    if (this.quoted && !this.quotePending) this.malformed = true;
    if (this.field || this.row.length || this.quotePending) this.pushRow();
  }
}

export function detectDelimiter(sample: string): string {
  const first = sample.split(/\r?\n/).find((line) => line.trim()) ?? "";
  let best = ",",
    score = 0;
  for (const delimiter of [",", ";", "\t"]) {
    let count = 0;
    let quote = false;
    for (let i = 0; i < first.length; i++) {
      if (first[i] === '"') {
        if (quote && first[i + 1] === '"') i++;
        else quote = !quote;
      } else if (!quote && first[i] === delimiter) count++;
    }
    if (count > score) {
      best = delimiter;
      score = count;
    }
  }
  return best;
}

export function detectEncoding(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return "utf-8";
  if (bytes.length > 8 && bytes[1] === 0 && bytes[3] === 0) return "utf-16le";
  if (bytes.length > 8 && bytes[0] === 0 && bytes[2] === 0) return "utf-16be";
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: true });
    return "utf-8";
  } catch {
    return "windows-1252";
  }
}
