import { describe, expect, it } from "vitest";

import {
  getColorFamilyForEpisode,
  getColorFamilyForPatternKey,
  getColorFamilyForRule,
} from "@/lib/color/cluster-palette";
import {
  normalizePatternKey,
  resolvePatternKeyFromRaw,
  resolveClusterColor,
} from "@/lib/feed/card-color";

describe("card color utilities", () => {
  describe("normalizePatternKey", () => {
    it("returns a PatternKey for valid values", () => {
      expect(normalizePatternKey("review-hygiene")).toBe("review-hygiene");
    });

    it("returns null for invalid or non-string values", () => {
      expect(normalizePatternKey("not-a-pattern")).toBeNull();
      expect(normalizePatternKey(42)).toBeNull();
      expect(normalizePatternKey(null)).toBeNull();
    });
  });

  describe("resolvePatternKeyFromRaw", () => {
    it("prefers nested episode.pattern_key over top-level values", () => {
      const result = resolvePatternKeyFromRaw({
        episode: { pattern_key: "error-contract" },
        pattern_key: "review-hygiene",
        rule_key: "idempotency",
      });

      expect(result).toBe("error-contract");
    });

    it("falls back to top-level pattern_key then rule_key", () => {
      expect(resolvePatternKeyFromRaw({ pattern_key: "input-validation" })).toBe("input-validation");
      expect(resolvePatternKeyFromRaw({ rule_key: "retry-strategy" })).toBe("retry-strategy");
    });

    it("returns null when no valid pattern keys exist", () => {
      expect(
        resolvePatternKeyFromRaw({
          episode: { pattern_key: "unknown" },
          pattern_key: "also-unknown",
          rule_key: 7,
        }),
      ).toBeNull();
    });
  });

  describe("resolveClusterColor", () => {
    it("uses pattern color when a valid pattern key exists", () => {
      const raw = { pattern_key: "auth-token-handling" };

      expect(resolveClusterColor("rule-123", raw)).toEqual(getColorFamilyForPatternKey("auth-token-handling"));
    });

    it("falls back to rule-based colors when no pattern key is available", () => {
      expect(resolveClusterColor("rule-abc", {})).toEqual(getColorFamilyForRule("rule-abc"));
    });

    it("falls back to episode-based colors for non-rule node IDs", () => {
      expect(resolveClusterColor("episode-xyz", {})).toEqual(getColorFamilyForEpisode("episode-xyz"));
    });
  });
});
