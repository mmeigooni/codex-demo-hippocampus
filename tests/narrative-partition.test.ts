import { describe, expect, it } from "vitest";

import type { ActivityEventView } from "@/components/feed/ActivityCard";
import {
  EVENT_TYPE_LABELS,
  partitionIntoNarrative,
  patternDisplayLabel,
  type NarrativePhase,
} from "@/lib/feed/narrative-partition";
import { PATTERN_KEYS } from "@/lib/memory/pattern-taxonomy";

function event(
  view: Partial<ActivityEventView> & Pick<ActivityEventView, "id" | "type" | "title">,
): ActivityEventView {
  return {
    raw: {},
    ...view,
  };
}

function phaseFrom(
  events: ActivityEventView[],
  associations: Map<string, string> = new Map(),
): NarrativePhase {
  return partitionIntoNarrative(events, associations).phase;
}

describe("patternDisplayLabel", () => {
  it("returns taxonomy display names for all known pattern keys", () => {
    for (const key of PATTERN_KEYS) {
      const label = patternDisplayLabel(key);
      expect(label).not.toBe("Unknown pattern");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("falls back to normalized key text for unknown keys", () => {
    expect(patternDisplayLabel("custom-risk-pattern")).toBe("Custom Risk Pattern");
  });

  it("returns Unknown pattern for missing or blank values", () => {
    expect(patternDisplayLabel(undefined)).toBe("Unknown pattern");
    expect(patternDisplayLabel("  ")).toBe("Unknown pattern");
  });
});

describe("partitionIntoNarrative", () => {
  it("filters hidden events and routes sections", () => {
    const events: ActivityEventView[] = [
      event({ id: "hidden-import", type: "pr_found", title: "Hidden import event" }),
      event({ id: "obs-1", type: "episode_created", title: "Observation 1", graphNodeId: "episode-1" }),
      event({ id: "pr-group-1", type: "pr_group", title: "PR group", graphNodeIds: ["episode-1"] }),
      event({ id: "milestone-1", type: "pattern_detected", title: "Pattern detected" }),
      event({ id: "milestone-2", type: "contradiction_found", title: "Contradiction found" }),
      event({ id: "hidden-salience", type: "salience_updated", title: "Hidden salience" }),
      event({ id: "reasoning-older", type: "reasoning", title: "Reasoning", variant: "reasoning", reasoningText: "older" }),
      event({ id: "rule-1", type: "rule_promoted", title: "Rule 1", raw: { rule_id: "r1", title: "Rule 1" } }),
      event({
        id: "ep-associated",
        type: "episode_created",
        title: "Associated episode",
        graphNodeId: "episode-1",
        whyItMatters: "Matters",
      }),
      event({ id: "reasoning-newer", type: "reasoning", title: "Reasoning", variant: "reasoning", reasoningText: "newer" }),
    ];

    const associations = new Map<string, string>([["episode-1", "rule-r1"]]);

    const sections = partitionIntoNarrative(events, associations);

    expect(sections.observations.map((entry) => entry.id)).toEqual(["obs-1", "pr-group-1", "ep-associated"]);
    expect(sections.milestones.map((entry) => entry.id)).toEqual(["milestone-1", "milestone-2"]);
    expect(sections.reasoning?.id).toBe("reasoning-newer");
    expect(sections.insights).toHaveLength(1);
    expect(sections.insights[0]?.ruleId).toBe("rule-r1");
    expect(sections.insights[0]?.episodes.map((entry) => entry.id)).toEqual(["obs-1", "pr-group-1", "ep-associated"]);
  });

  it("derives observing phase when no milestones or insights exist", () => {
    const events = [event({ id: "obs-1", type: "episode_created", title: "Observation 1" })];
    expect(phaseFrom(events)).toBe("observing");
  });

  it("derives analyzing phase when milestones exist without whyItMatters insights", () => {
    const events = [event({ id: "milestone-1", type: "pattern_detected", title: "Pattern detected" })];
    expect(phaseFrom(events)).toBe("analyzing");
  });

  it("derives connecting phase when insights include whyItMatters", () => {
    const events = [
      event({ id: "rule-1", type: "rule_promoted", title: "Rule 1", raw: { rule_id: "r1", title: "Rule 1" } }),
      event({
        id: "obs-1",
        type: "episode_created",
        title: "Observation 1",
        graphNodeId: "episode-1",
        whyItMatters: "Explains impact",
      }),
    ];

    const associations = new Map<string, string>([["episode-1", "rule-r1"]]);
    expect(phaseFrom(events, associations)).toBe("connecting");
  });
});

describe("EVENT_TYPE_LABELS", () => {
  it("covers narrative-facing event labels", () => {
    expect(EVENT_TYPE_LABELS.episode_created).toBe("Observation");
    expect(EVENT_TYPE_LABELS.pattern_detected).toBe("Pattern Found");
    expect(EVENT_TYPE_LABELS.rule_promoted).toBe("Insight");
    expect(EVENT_TYPE_LABELS.contradiction_found).toBe("Tension");
    expect(EVENT_TYPE_LABELS.pr_group).toBe("Code Review");
  });
});
