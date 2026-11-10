import { useState } from "react";
import { Download, FileCode2, FileText, Table2 } from "lucide-react";
import { analyze } from "../analysis/rules";
import { exportCsv, reportHtml, reportPdf } from "../export/reports";
import { saveFile } from "../platform/files";
import type { PageProps } from "./Dashboard";
export function Reports({ session, range, onError }: PageProps) {
  const [technical, setTechnical] = useState(false);
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState("");
  async function download(type: "html" | "pdf" | "csv") {
    setBusy(type);
    setSaved("");
    try {
      const observations = analyze(session, undefined, range);
      const blob =
        type === "csv"
          ? exportCsv(session, range)
          : type === "html"
            ? new Blob([reportHtml(session, observations, range, technical)], {
                type: "text/html;charset=utf-8",
              })
            : await reportPdf(session, observations, range, technical);
      if (await saveFile(`PulseTrace-relatorio.${type}`, blob))
        setSaved(`Arquivo ${type.toUpperCase()} exportado.`);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <section className="panel form-panel">
        <h3>Uma análise que você pode compartilhar</h3>
        <p>
          Os relatórios priorizam gráficos e os sensores importantes, distinguem medições de
          hipóteses e incluem as limitações da análise. Revise nomes de arquivos
          e dispositivos antes de compartilhar.
        </p>
        <label className="inline-label">
          Estilo do relatório
          <select
            value={technical ? "technical" : "simple"}
            onChange={(e) => setTechnical(e.target.value === "technical")}
          >
            <option value="simple">Visual e direto (recomendado)</option>
            <option value="technical">Técnico (todos os sensores)</option>
          </select>
        </label>
      </section>
      <div className="export-grid">
        {[
          {
            type: "html" as const,
            Icon: FileCode2,
            title: "Relatório HTML",
            text: "Resumo visual com gráficos, áreas para investigar e próximos passos. Abre sem internet.",
          },
          {
            type: "pdf" as const,
            Icon: FileText,
            title: "Relatório PDF",
            text: "Resumo paginado com tendências, hipóteses e roteiro de verificação.",
          },
          {
            type: "csv" as const,
            Icon: Table2,
            title: "Dados filtrados",
            text: "Leituras do intervalo, em UTC e unidades normalizadas. Valores ausentes ficam vazios.",
          },
        ].map(({ type, Icon, title, text }) => (
          <section key={type} className="panel export-card">
            <Icon size={30} />
            <h3>{title}</h3>
            <p>{text}</p>
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() => void download(type)}
            >
              <Download size={15} />
              {busy === type ? "Preparando…" : `Exportar ${type.toUpperCase()}`}
            </button>
          </section>
        ))}
      </div>
      <div className="info-box">
        Para salvar um gráfico em PNG, use o botão de download no canto superior
        direito do gráfico. O PNG reflete o zoom atual; os cálculos dos
        relatórios usam as leituras originais.
      </div>
      {saved && (
        <p role="status" className="text-teal">
          {saved}
        </p>
      )}
    </>
  );
}
