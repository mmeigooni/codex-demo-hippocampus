import { describe, expect, it } from "vitest";

import { distributionFallbackMessage } from "@/lib/distribution/ui-state";

describe("distributionFallbackMessage", () => {
  it("returns a generic preview message for memory fallback", () => {
    const message = distributionFallbackMessage("memory-fallback");

    expect(message).toContain("Preview mode");
    expect(message).toContain("Copy it below and open a PR manually.");
    expect(message).not.toContain("PR creation failed");
  });

  it("returns a failure-specific preview message for PR errors", () => {
    const message = distributionFallbackMessage("GitHub API request failed (status 404)");

    expect(message).toContain("PR creation failed");
    expect(message).toContain("status 404");
    expect(message).toContain("Copy it below and open a PR manually.");
  });

  it("handles missing reasons with a safe default", () => {
    const message = distributionFallbackMessage();

    expect(message).toBe("Preview mode: markdown was generated. Copy it below and open a PR manually.");
  });
});

