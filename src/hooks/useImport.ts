import { useEffect, useRef, useState } from "react";
import type { ImportOptions, Session } from "../core/types";
import { LIMITS } from "../core/types";
import { readNativeFile } from "../platform/files";
export function useImport(onSession: (session: Session) => void) {
  const [progress, setProgress] = useState<{
    name: string;
    percent: number;
  } | null>(null);
  const [error, setError] = useState("");
  const active = useRef<{ worker?: Worker; cancel?: () => void } | null>(null);
  const cancel = () => {
    active.current?.worker?.terminate();
    active.current?.cancel?.();
    active.current = null;
    setProgress(null);
  };
  useEffect(
    () => () => {
      active.current?.worker?.terminate();
      active.current?.cancel?.();
    },
    [],
  );
  async function importFiles(
    files: (File | string)[],
    options: ImportOptions,
    available: number,
    cellBudget: number,
  ) {
    if (active.current) return;
    setError("");
    if (!files.length) {
      setError("Nenhum CSV encontrado na pasta selecionada.");
      return;
    }
    if (files.length > available) {
      setError(
        `Há espaço para ${available} sessão(ões). Selecione menos arquivos ou remova uma sessão aberta. Máximo: ${LIMITS.sessions}.`,
      );
      return;
    }
    const token: { worker?: Worker; cancel?: () => void } = {};
    active.current = token;
    let remaining = cellBudget;
    const failures: string[] = [];
    for (const source of files) {
      if (active.current !== token) break;
      try {
        const name =
          typeof source === "string"
            ? source.split(/[\\/]/).pop()!
            : source.name;
        if (!/\.csv$/i.test(name))
          throw new Error("Selecione arquivos com extensão .csv.");
        setProgress({ name, percent: 0 });
        const file =
          typeof source === "string"
            ? await readNativeFile(source, () => active.current !== token)
            : source;
        if (active.current !== token) break;
        const session = await new Promise<Session>((resolve, reject) => {
          const worker = new Worker(
            new URL("../import/worker.ts", import.meta.url),
            { type: "module" },
          );
          token.worker = worker;
          token.cancel = () =>
            reject(new DOMException("Importação cancelada", "AbortError"));
          worker.onmessage = (
            event: MessageEvent<{
              type: string;
              percent: number;
              session: Session;
              message: string;
            }>,
          ) => {
            if (event.data.type === "progress")
              setProgress({ name, percent: event.data.percent });
            if (event.data.type === "done") {
              worker.terminate();
              resolve(event.data.session);
            }
            if (event.data.type === "error") {
              worker.terminate();
              reject(new Error(event.data.message));
            }
          };
          worker.onerror = () => {
            worker.terminate();
            reject(new Error("Falha no processamento em segundo plano."));
          };
          worker.postMessage({ file, options });
        });
        const cells = session.times.length * session.sensors.length;
        if (cells > remaining)
          throw new Error(
            "Limite total de 12 milhões de valores nas sessões abertas. Remova uma sessão antes de continuar.",
          );
        remaining -= cells;
        if (active.current === token) onSession(session);
      } catch (e) {
        if (active.current !== token) break;
        failures.push(e instanceof Error ? e.message : String(e));
      }
    }
    if (active.current === token) {
      active.current = null;
      setProgress(null);
      setError(failures.join(" "));
    }
  }
  return { progress, error, setError, importFiles, cancel };
}
