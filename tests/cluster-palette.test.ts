import { describe, expect, it } from "vitest";

import { PATTERN_KEYS } from "@/lib/memory/pattern-taxonomy";
import {
  CLUSTER_PALETTE,
  type ColorFamily,
  getColorFamilyByIndex,
  getColorFamilyForPatternKey,
  getColorFamilyForEpisode,
  getColorFamilyForRule,
} from "@/lib/color/cluster-palette";

describe("cluster palette", () => {
  it("exports exactly four color families", () => {
    expect(CLUSTER_PALETTE).toHaveLength(4);
  });

  it("is deterministic for rule and episode IDs", () => {
    expect(getColorFamilyForRule("rule-123")).toBe(getColorFamilyForRule("rule-123"));
    expect(getColorFamilyForEpisode("episode-abc")).toBe(getColorFamilyForEpisode("episode-abc"));
  });

  it("normalizes boundary indexes", () => {
    expect(getColorFamilyByIndex(-1)).toBe(CLUSTER_PALETTE[3]);
    expect(getColorFamilyByIndex(4)).toBe(CLUSTER_PALETTE[0]);
    expect(getColorFamilyByIndex(42)).toBe(CLUSTER_PALETTE[2]);
  });

  it("maps pattern keys through their super-category color families", () => {
    expect(getColorFamilyForPatternKey("error-contract")).toBe(CLUSTER_PALETTE[0]);
    expect(getColorFamilyForPatternKey("retry-strategy")).toBe(CLUSTER_PALETTE[1]);
    expect(getColorFamilyForPatternKey("sensitive-logging")).toBe(CLUSTER_PALETTE[2]);
    expect(getColorFamilyForPatternKey("concurrency-serialization")).toBe(CLUSTER_PALETTE[3]);

    const seen = new Set<ColorFamily>();
    for (const key of PATTERN_KEYS) {
      seen.add(getColorFamilyForPatternKey(key));
    }

    expect(seen.size).toBe(4);
  });

  it("can reach all four families through hash mapping", () => {
    const seen = new Set<number>();

    for (let index = 0; index < 20_000; index += 1) {
      const family = getColorFamilyForRule(`rule-${index}`);
      const paletteIndex = CLUSTER_PALETTE.findIndex((candidate) => candidate === family);

      if (paletteIndex >= 0) {
        seen.add(paletteIndex);
      }

      if (seen.size === CLUSTER_PALETTE.length) {
        break;
      }
    }

    expect(seen.size).toBe(CLUSTER_PALETTE.length);
  });
});
