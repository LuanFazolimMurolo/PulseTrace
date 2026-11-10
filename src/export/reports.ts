import type { Observation, Session, TimeRange } from "../core/types";
export const escapeHtml = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function csvCell(v: string) {
  // Prevent spreadsheet formula injection, including leading whitespace/control characters.
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function exportCsv(session: Session, range: TimeRange): Blob {
  const parts: string[] = [
    "\uFEFF",
    [
      "Timestamp",
      ...session.sensors.map(
        (s) =>
          `${s.label} {${s.id}} [${s.unit === "estado" ? "Yes/No" : s.unit}]`,
      ),
    ]
      .map(csvCell)
      .join(";") + "\r\n",
  ];
  for (let i = 0; i < session.times.length; i++) {
    if (session.times[i] < range[0] || session.times[i] > range[1]) continue;
    // Numeric cells come from finite typed values, never from untrusted expressions.
    // Quote negative numbers without an apostrophe so normalized exports can be reimported.
    parts.push(
      [
        csvCell(new Date(session.times[i]).toISOString()),
        ...session.sensors.map(
          (s) => `"${Number.isFinite(s.values[i]) ? String(s.values[i]) : ""}"`,
        ),
      ].join(";") + "\r\n",
    );
  }
  return new Blob(parts, { type: "text/csv;charset=utf-8" });
}
import { visualHtml, visualPdf } from "./visual";
export function reportHtml(session: Session, observations: Observation[], range: TimeRange, technical: boolean): string {
  return visualHtml(session, observations, range, technical);
}
export async function reportPdf(session: Session, observations: Observation[], range: TimeRange, technical: boolean): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  visualPdf(doc, session, observations, range, technical);
  return doc.output("blob");
}
