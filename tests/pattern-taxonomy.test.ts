import { describe, expect, it } from "vitest";

import {
  getSuperCategoryForPattern,
  mapToPatternKey,
  PATTERN_KEYS,
  PATTERN_SUPER_CATEGORY,
  patternLabelForKey,
  SUPER_CATEGORY_KEYS,
  SUPER_CATEGORY_LABELS,
} from "@/lib/memory/pattern-taxonomy";

describe("pattern taxonomy", () => {
  it("maps token propagation incidents to auth-token-handling", () => {
    const key = mapToPatternKey({
      title: "stop forwarding upstream bearer tokens",
      triggers: ["bearer-token-forwarding", "credential-propagation"],
    });

    expect(key).toBe("auth-token-handling");
    expect(patternLabelForKey(key)).toBe("Auth token handling");
  });

  it("returns a deterministic default for unknown inputs", () => {
    const first = mapToPatternKey({ title: "misc cleanup" });
    const second = mapToPatternKey({ title: "misc cleanup" });

    expect(first).toBe(second);
  });

  it("exposes stable super-category metadata", () => {
    expect(SUPER_CATEGORY_KEYS).toEqual(["safety", "resilience", "security", "flow"]);
    expect(SUPER_CATEGORY_LABELS).toEqual({
      safety: "Safety",
      resilience: "Resilience",
      security: "Security",
      flow: "Flow",
    });
  });

  it("maps every pattern key to exactly one super-category", () => {
    for (const key of PATTERN_KEYS) {
      expect(PATTERN_SUPER_CATEGORY[key]).toBeDefined();
      expect(getSuperCategoryForPattern(key)).toBe(PATTERN_SUPER_CATEGORY[key]);
      expect(SUPER_CATEGORY_KEYS).toContain(PATTERN_SUPER_CATEGORY[key]);
    }
  });

  it("maps known patterns to expected super-categories", () => {
    expect(getSuperCategoryForPattern("error-contract")).toBe("safety");
    expect(getSuperCategoryForPattern("input-validation")).toBe("safety");
    expect(getSuperCategoryForPattern("retry-strategy")).toBe("resilience");
    expect(getSuperCategoryForPattern("dependency-resilience")).toBe("resilience");
    expect(getSuperCategoryForPattern("idempotency")).toBe("resilience");
    expect(getSuperCategoryForPattern("sensitive-logging")).toBe("security");
    expect(getSuperCategoryForPattern("auth-token-handling")).toBe("security");
    expect(getSuperCategoryForPattern("concurrency-serialization")).toBe("flow");
    expect(getSuperCategoryForPattern("state-transition")).toBe("flow");
    expect(getSuperCategoryForPattern("review-hygiene")).toBe("flow");
  });
});
