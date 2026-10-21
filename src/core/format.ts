export const number = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
export const time = (n: number) =>
  new Date(n).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
export const dateTime = (n: number) => new Date(n).toLocaleString("pt-BR");
export function duration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s >= 3600
    ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
    : s >= 60
      ? `${Math.floor(s / 60)} min ${s % 60} s`
      : `${s} s`;
}
export const severityLabel = {
  normal: "Normal",
  warning: "Atenção",
  critical: "Crítico",
  insufficient: "Dados insuficientes",
};
