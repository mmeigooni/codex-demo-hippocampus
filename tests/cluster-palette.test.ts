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
  it("exports exactly ten color families", () => {
    expect(CLUSTER_PALETTE).toHaveLength(10);
  });

  it("is deterministic for rule and episode IDs", () => {
    expect(getColorFamilyForRule("rule-123")).toBe(getColorFamilyForRule("rule-123"));
    expect(getColorFamilyForEpisode("episode-abc")).toBe(getColorFamilyForEpisode("episode-abc"));
  });

  it("normalizes boundary indexes", () => {
    expect(getColorFamilyByIndex(-1)).toBe(CLUSTER_PALETTE[9]);
    expect(getColorFamilyByIndex(10)).toBe(CLUSTER_PALETTE[0]);
    expect(getColorFamilyByIndex(42)).toBe(CLUSTER_PALETTE[2]);
  });

  it("maps pattern keys to deterministic unique color families", () => {
    expect(getColorFamilyForPatternKey("sensitive-logging")).toBe(CLUSTER_PALETTE[2]);

    const seen = new Set<ColorFamily>();
    for (const key of PATTERN_KEYS) {
      seen.add(getColorFamilyForPatternKey(key));
    }

    expect(seen.size).toBe(PATTERN_KEYS.length);
  });

  it("can reach all ten families through hash mapping", () => {
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
