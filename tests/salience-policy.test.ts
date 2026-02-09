import { afterEach, describe, expect, it } from "vitest";

import {
  DEMO_SALIENCE_TARGETS_BY_PR,
  boundConsolidationDelta,
  calibrateInitialSalience,
  isConfiguredDemoRepo,
} from "@/lib/codex/salience-policy";

const ORIGINAL_DEMO_REPO = process.env.DEMO_REPO;

afterEach(() => {
  if (ORIGINAL_DEMO_REPO === undefined) {
    delete process.env.DEMO_REPO;
    return;
  }

  process.env.DEMO_REPO = ORIGINAL_DEMO_REPO;
});

describe("DEMO_SALIENCE_TARGETS_BY_PR", () => {
  it("contains the full W06 mapping", () => {
    expect(Object.keys(DEMO_SALIENCE_TARGETS_BY_PR)).toHaveLength(18);
    expect(DEMO_SALIENCE_TARGETS_BY_PR[1]).toBe(9);
    expect(DEMO_SALIENCE_TARGETS_BY_PR[17]).toBe(2);
    expect(DEMO_SALIENCE_TARGETS_BY_PR[18]).toBe(7);
  });
});

describe("isConfiguredDemoRepo", () => {
  it("matches default demo repo when DEMO_REPO is unset", () => {
    delete process.env.DEMO_REPO;

    expect(isConfiguredDemoRepo("mmeigooni/shopflow-platform")).toBe(true);
    expect(isConfiguredDemoRepo("mmeigooni/other-repo")).toBe(false);
  });

  it("matches configured demo repo case-insensitively", () => {
    process.env.DEMO_REPO = "Acme/Checkout-Memory";

    expect(isConfiguredDemoRepo("acme/checkout-memory")).toBe(true);
    expect(isConfiguredDemoRepo("acme/checkout")).toBe(false);
  });
});

describe("calibrateInitialSalience", () => {
  it("caps retry strategy to its configured band", () => {
    const calibrated = calibrateInitialSalience({
      rawScore: 10,
      patternKey: "retry-strategy",
    });

    expect(calibrated).toBe(9);
  });

  it("raises review hygiene to its minimum band", () => {
    const calibrated = calibrateInitialSalience({
      rawScore: 0,
      patternKey: "review-hygiene",
    });

    expect(calibrated).toBe(1);
  });

  it("falls back to band minimum for invalid raw scores", () => {
    const calibrated = calibrateInitialSalience({
      rawScore: Number.NaN,
      patternKey: "error-contract",
    });

    expect(calibrated).toBe(4);
  });
});

describe("boundConsolidationDelta", () => {
  it("caps upward deltas", () => {
    expect(boundConsolidationDelta({ currentScore: 5, proposedScore: 10, maxDelta: 3 })).toBe(8);
  });

  it("caps downward deltas", () => {
    expect(boundConsolidationDelta({ currentScore: 5, proposedScore: 0, maxDelta: 3 })).toBe(2);
  });

  it("keeps updates within bounds unchanged", () => {
    expect(boundConsolidationDelta({ currentScore: 6, proposedScore: 8, maxDelta: 3 })).toBe(8);
  });
});
