import { describe, expect, it } from "vitest";

import { collectExistingPrNumbers, isUniqueViolationError } from "@/lib/github/import-idempotency";

describe("import idempotency helpers", () => {
  it("collects non-null PR numbers into a set", () => {
    const result = collectExistingPrNumbers([
      { source_pr_number: 10 },
      { source_pr_number: null },
      { source_pr_number: 11 },
      { source_pr_number: 10 },
    ]);

    expect(Array.from(result).sort((a, b) => a - b)).toEqual([10, 11]);
  });

  it("detects postgres unique-violation errors", () => {
    expect(isUniqueViolationError({ code: "23505" })).toBe(true);
    expect(isUniqueViolationError({ code: "PGRST205" })).toBe(false);
    expect(isUniqueViolationError(new Error("boom"))).toBe(false);
  });
});
