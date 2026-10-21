import { parseFile } from "./parser";
import type { ImportOptions } from "../core/types";
self.onmessage = async (
  event: MessageEvent<{ file: File; options: ImportOptions }>,
) => {
  try {
    const session = await parseFile(
      event.data.file,
      event.data.options,
      (percent) => self.postMessage({ type: "progress", percent }),
    );
    const transfers = [
      session.times.buffer,
      ...session.sensors.map((s) => s.values.buffer),
    ] as ArrayBuffer[];
    self.postMessage({ type: "done", session }, { transfer: transfers });
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "Não foi possível ler o CSV.",
    });
  }
};
