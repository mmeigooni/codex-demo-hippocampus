import { describe, expect, it } from "vitest";

import {
  repoSelectorCollapsedStatusText,
  sleepCycleButtonLabel,
  type OnboardingPhase,
} from "@/components/onboarding/onboarding-activity";

describe("sleepCycleButtonLabel", () => {
  it("returns running copy while consolidation is active", () => {
    expect(sleepCycleButtonLabel("ready", true)).toBe("Running sleep cycle...");
  });

  it("returns rerun copy after consolidation-related phases", () => {
    expect(sleepCycleButtonLabel("consolidated", false)).toBe("Re-run Sleep Cycle");
    expect(sleepCycleButtonLabel("distributing", false)).toBe("Re-run Sleep Cycle");
    expect(sleepCycleButtonLabel("distributed", false)).toBe("Re-run Sleep Cycle");
  });

  it("returns default run copy before consolidation", () => {
    expect(sleepCycleButtonLabel("ready", false)).toBe("Run Sleep Cycle");
    expect(sleepCycleButtonLabel("importing", false)).toBe("Run Sleep Cycle");
  });
});

describe("repoSelectorCollapsedStatusText", () => {
  it("returns phase-aligned status text for known phases", () => {
    const repo = "mmeigooni/shopflow-platform";

    const expectations: Array<{ phase: OnboardingPhase; expected: string }> = [
      { phase: "importing", expected: `Importing ${repo}...` },
      { phase: "ready", expected: `Import complete for ${repo}.` },
      { phase: "consolidating", expected: `Running Sleep Cycle for ${repo}...` },
      { phase: "consolidated", expected: `Sleep Cycle complete for ${repo}.` },
      { phase: "distributing", expected: `Distributing to repo for ${repo}...` },
      { phase: "distributed", expected: `Distribution complete for ${repo}.` },
    ];

    for (const { phase, expected } of expectations) {
      expect(repoSelectorCollapsedStatusText(phase, repo)).toBe(expected);
    }
  });

  it("falls back to repository label when active repo is missing", () => {
    expect(repoSelectorCollapsedStatusText("idle", null)).toBe("Connected to repository.");
  });
});
