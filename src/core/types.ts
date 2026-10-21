export type Component = "CPU" | "GPU" | "Memória" | "Armazenamento" | "Sistema";
export type Metric =
  | "temperature"
  | "usage"
  | "clock"
  | "power"
  | "throttle"
  | "memory"
  | "rate"
  | "latency"
  | "health"
  | "other";
export type Severity = "normal" | "warning" | "critical" | "insufficient";
export interface Sensor {
  id: string;
  identity: string;
  label: string;
  original: string;
  device: string;
  component: Component;
  metric: Metric;
  unit: string;
  sourceUnit: string;
  values: Float32Array;
  min: number | null;
  max: number | null;
  mean: number | null;
  count: number;
}
export interface Quality {
  encoding: string;
  delimiter: string;
  totalRows: number;
  invalidTimestamps: number;
  repeatedTimestamps: number;
  outOfOrder: number;
  incompleteRows: number;
  invalidValues: number;
  missingValues: number;
  skippedRows: number;
  warnings: string[];
}
export interface Gap {
  start: number;
  end: number;
  duration: number;
}
export interface Session {
  id: string;
  name: string;
  size: number;
  demo: boolean;
  times: Float64Array;
  sensors: Sensor[];
  quality: Quality;
  gaps: Gap[];
  cadence: number;
  clock: string;
  importedAt: number;
}
export interface Observation {
  id: string;
  rule: string;
  component: Component;
  severity: Severity;
  title: string;
  sensorId?: string;
  sensor: string;
  value: number | null;
  unit: string;
  time: number;
  duration: number | null;
  explanation: string;
  causes: string[];
  checks: string[];
  confidence: "Alta" | "Moderada" | "Baixa";
  limitation: string;
}
export interface ImportOptions {
  dateOrder: "DMY" | "MDY";
  utcOffsetMinutes: number;
}
export interface Marker {
  id: string;
  time: number;
  text: string;
}
export interface WindowsEvent {
  time: number;
  id: number;
  provider: string;
  message: string;
}
export type TimeRange = [number, number];
export const LIMITS = {
  fileBytes: 64 * 1024 * 1024,
  columns: 4096,
  rows: 1_000_000,
  cells: 6_000_000,
  sessions: 3,
  totalCells: 12_000_000,
  fieldChars: 16_384,
  rowChars: 1_048_576,
};
