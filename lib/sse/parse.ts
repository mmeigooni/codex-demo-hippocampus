export interface ParsedJsonSseEvent<T = Record<string, unknown>> {
  type: string;
  data: T;
}

export function parseJsonSseBuffer<T = Record<string, unknown>>(rawBuffer: string) {
  const chunks = rawBuffer.split("\n\n");
  const remainder = chunks.pop() ?? "";

  const events = chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap((chunk) => {
      const dataLines = chunk
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6));

      if (dataLines.length === 0) {
        return [];
      }

      try {
        return [JSON.parse(dataLines.join("\n")) as ParsedJsonSseEvent<T>];
      } catch {
        return [];
      }
    });

  return { events, remainder };
}
