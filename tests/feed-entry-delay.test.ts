import { describe, expect, it } from "vitest";

import { entryDelay } from "@/lib/feed/entry-delay";

describe("entryDelay", () => {
  it("returns deterministic values for identical inputs", () => {
    const first = entryDelay("episode-42", 3);
    const second = entryDelay("episode-42", 3);

    expect(first).toBe(second);
  });

  it("applies base stagger in 120ms steps for the same event", () => {
    const previous = entryDelay("episode-42", 1);
    const next = entryDelay("episode-42", 2);

    expect(next - previous).toBeCloseTo(0.12, 6);
  });

  it("keeps jitter within the expected 0-150ms range", () => {
    const delay = entryDelay("episode-42", 4);
    const base = 4 * 0.12;
    const jitter = delay - base;

    expect(jitter).toBeGreaterThanOrEqual(0);
    expect(jitter).toBeLessThanOrEqual(0.15);
  });

  it("clamps invalid indices to zero base stagger", () => {
    const valid = entryDelay("episode-42", 0);
    const negative = entryDelay("episode-42", -5);
    const notFinite = entryDelay("episode-42", Number.NaN);

    expect(negative).toBe(valid);
    expect(notFinite).toBe(valid);
  });
});
