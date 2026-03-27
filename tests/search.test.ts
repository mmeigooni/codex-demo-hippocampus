import { describe, expect, it } from "vitest";

import { executeSearch, summarizeTokenReduction } from "@/lib/codex/search";

describe("search", () => {
  it("extracts snippets using ast-grep rules", () => {
    const diff = [
      "diff --git a/payments.ts b/payments.ts",
      "--- a/payments.ts",
      "+++ b/payments.ts",
      "@@",
      "+function run(orderId: string) {",
      "+  retryPayment(orderId);",
      "+}",
    ].join("\n");

    const snippets = executeSearch(diff, [
      {
        language: "typescript",
        rule: "$FUNC($$$ARGS)",
        intent: "function-call",
      },
    ]);

    expect(snippets.length).toBeGreaterThan(0);
    expect(snippets[0]?.text).toContain("retryPayment");
  });

  it("computes token reduction metadata", () => {
    const diff = "diff --git a/a.ts b/a.ts\n+++ b/a.ts\n+const value = callMe(1);";
    const snippets = [{ filePath: "a.ts", language: "typescript", text: "callMe(1)", intent: "call" }];

    const summary = summarizeTokenReduction(diff, snippets);

    expect(summary.rawTokens).toBeGreaterThan(0);
    expect(summary.reducedTokens).toBeGreaterThan(0);
    expect(summary.reductionRatio).toBeGreaterThanOrEqual(0);
    expect(summary.reductionRatio).toBeLessThanOrEqual(1);
  });
});
