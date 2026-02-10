export interface ParsedJsonSseEvent<T = unknown> {
  type: string;
  data: T;
}

function toObject(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(Object.entries(value));
}

export function parseJsonSseBuffer<T = unknown>(rawBuffer: string) {
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
        const parsed = JSON.parse(dataLines.join("\n"));
        const parsedRecord = toObject(parsed);
        if (!parsedRecord || typeof parsedRecord.type !== "string" || !("data" in parsedRecord)) {
          return [];
        }

        return [
          {
            type: parsedRecord.type,
            data: parsedRecord.data as T,
          },
        ];
      } catch {
        return [];
      }
    });

  return { events, remainder };
}
