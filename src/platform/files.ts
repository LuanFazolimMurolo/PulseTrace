import { isTauri } from "@tauri-apps/api/core";
import { LIMITS } from "../core/types";
export { isTauri };

export async function chooseNativeFiles(folder: boolean): Promise<string[]> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    directory: folder,
    multiple: !folder,
    title: folder
      ? "Selecionar pasta de registros"
      : "Importar registros do HWiNFO64",
    filters: folder
      ? undefined
      : [{ name: "Registro de sensores", extensions: ["csv"] }],
  });
  if (!result) return [];
  if (!folder) return Array.isArray(result) ? result : [result];
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const { join } = await import("@tauri-apps/api/path");
  const directory = result as string;
  const entries = await readDir(directory);
  return Promise.all(
    entries
      .filter((e) => e.isFile && /\.csv$/i.test(e.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => join(directory, e.name)),
  );
}

export async function readNativeFile(
  path: string,
  cancelled: () => boolean = () => false,
): Promise<File> {
  const { open } = await import("@tauri-apps/plugin-fs");
  const handle = await open(path, { read: true });
  try {
    const meta = await handle.stat();
    if (!meta.isFile || meta.size > LIMITS.fileBytes)
      throw new Error("Selecione um arquivo de até 64 MiB.");
    const chunks: ArrayBuffer[] = [];
    let total = 0;
    while (true) {
      if (cancelled())
        throw new DOMException("Importação cancelada", "AbortError");
      const data = new Uint8Array(256 * 1024);
      const n = await handle.read(data);
      if (!n) break;
      total += n;
      if (total > LIMITS.fileBytes)
        throw new Error("O arquivo cresceu além de 64 MiB durante a leitura.");
      chunks.push(data.buffer.slice(0, n));
    }
    return new File(chunks, path.split(/[\\/]/).pop() ?? "registro.csv");
  } finally {
    await handle.close();
  }
}

export async function saveFile(name: string, blob: Blob): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: name,
      filters: [
        {
          name: name.split(".").pop()!.toUpperCase(),
          extensions: [name.split(".").pop()!],
        },
      ],
    });
    if (!path) return false;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  return true;
}
