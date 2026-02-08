import { describe, expect, it } from "vitest";

import { mapToPatternKey, patternLabelForKey } from "@/lib/memory/pattern-taxonomy";

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
});
