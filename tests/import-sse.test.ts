import { describe, expect, it } from "vitest";

import { parseJsonSseBuffer } from "@/lib/sse/parse";

describe("parseJsonSseBuffer", () => {
  it("parses complete events and preserves remainder", () => {
    const input = [
      'data: {"type":"encoding_start","data":{"pr_number":12}}',
      "",
      'data: {"type":"episode_created","data":{"episode":{"id":"ep-1"}}}',
      "",
      'data: {"type":"partial","data":{"x":1}}',
    ].join("\n");

    const parsed = parseJsonSseBuffer(input);

    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0]?.type).toBe("encoding_start");
    expect(parsed.events[1]?.type).toBe("episode_created");
    expect(parsed.remainder).toContain('"partial"');
  });

  it("ignores invalid json payloads", () => {
    const parsed = parseJsonSseBuffer('data: invalid-json\n\n');
    expect(parsed.events).toHaveLength(0);
    expect(parsed.remainder).toBe("");
  });
});
