import { describe, expect, it } from "vitest";

import type { BrainNodeModel } from "@/components/brain/types";
import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { resolveSelectedNarrative } from "@/components/onboarding/OnboardingFlow";
import type { AssociatedRuleGroup } from "@/lib/feed/association-state";

function activityEvent(
  event: Partial<ActivityEventView> & Pick<ActivityEventView, "id" | "type" | "title">,
): ActivityEventView {
  return {
    raw: {},
    ...event,
  };
}

describe("resolveSelectedNarrative", () => {
  it("returns null when no node is selected", () => {
    const narrative = resolveSelectedNarrative({
      activityEvents: [],
      selectedNodeId: null,
      selectedNodeType: null,
      selectedPatternKey: null,
    });

    expect(narrative).toBeNull();
  });

  it("resolves episode narrative using latest matching event and subtitle-first pattern", () => {
    const events: ActivityEventView[] = [
      activityEvent({
        id: "ep-old",
        type: "episode_created",
        title: "Episode old",
        subtitle: "Old pattern label",
        graphNodeId: "episode-1",
        whatHappened: "Old happened",
        theFix: "Old fix",
        whyItMatters: "Old why",
        raw: {
          episode: {
            the_pattern: "retry-strategy",
          },
        },
      }),
      activityEvent({
        id: "ep-new",
        type: "episode_created",
        title: "Episode new",
        subtitle: "Input validation",
        graphNodeId: "episode-1",
        whatHappened: "Guard clause skipped null payload validation",
        theFix: "Added schema validation before side effects",
        whyItMatters: "Avoids malformed writes",
        raw: {
          episode: {
            the_pattern: "retry-strategy",
          },
        },
      }),
    ];

    const narrative = resolveSelectedNarrative({
      activityEvents: events,
      selectedNodeId: "episode-1",
      selectedNodeType: "episode",
      selectedPatternKey: null,
    });

    expect(narrative).toEqual({
      whatHappened: "Guard clause skipped null payload validation",
      thePattern: "Input validation",
      theFix: "Added schema validation before side effects",
      whyItMatters: "Avoids malformed writes",
    });
  });

  it("falls back to raw pattern key when episode subtitle is absent", () => {
    const events: ActivityEventView[] = [
      activityEvent({
        id: "ep-raw",
        type: "episode_created",
        title: "Episode raw",
        graphNodeId: "episode-2",
        raw: {
          episode: {
            the_pattern: "dependency-resilience",
          },
        },
      }),
    ];

    const narrative = resolveSelectedNarrative({
      activityEvents: events,
      selectedNodeId: "episode-2",
      selectedNodeType: "episode",
      selectedPatternKey: null,
    });

    expect(narrative?.thePattern).toBe("Dependency resilience");
  });

  it("resolves rule narrative with selected pattern key precedence and metadata", () => {
    const events: ActivityEventView[] = [
      activityEvent({
        id: "rule-r1",
        type: "rule_promoted",
        title: "Guard request body validation",
        graphNodeId: "rule-r1",
        raw: {
          rule_key: "input-validation",
          confidence: 0.82,
          episode_count: 3,
          description: "Prevents malformed payloads from reaching persistence paths.",
        },
      }),
    ];

    const narrative = resolveSelectedNarrative({
      activityEvents: events,
      selectedNodeId: "rule-r1",
      selectedNodeType: "rule",
      selectedPatternKey: "retry-strategy",
    });

    expect(narrative).toEqual({
      whatHappened: "3 observations converged into this rule.",
      thePattern: "Retry strategy",
      whyItMatters: "Prevents malformed payloads from reaching persistence paths.",
      ruleConfidence: 0.82,
      ruleEpisodeCount: 3,
    });
  });

  it("includes source observations when insight groups and index map are provided", () => {
    const events: ActivityEventView[] = [
      activityEvent({
        id: "rule-r1",
        type: "rule_promoted",
        title: "Guard request body validation",
        graphNodeId: "rule-r1",
        raw: {
          rule_key: "input-validation",
          confidence: 0.82,
          episode_count: 3,
          description: "Prevents malformed payloads from reaching persistence paths.",
        },
      }),
    ];

    const insightGroups: AssociatedRuleGroup[] = [
      {
        ruleId: "rule-r1",
        ruleTitle: "Guard request body validation",
        episodes: [
          activityEvent({
            id: "obs-2",
            type: "episode_created",
            title: "Observation 2",
            graphNodeId: "episode-2",
            whyItMatters: " Prevents malformed writes. ",
          }),
          activityEvent({
            id: "obs-3",
            type: "episode_created",
            title: "Observation 3",
            graphNodeId: "episode-3",
            whyItMatters: "Prevents malformed writes.",
          }),
          activityEvent({
            id: "obs-9",
            type: "episode_created",
            title: "Observation 9",
            graphNodeId: "episode-9",
          }),
        ],
      },
    ];

    const narrative = resolveSelectedNarrative({
      activityEvents: events,
      selectedNodeId: "rule-r1",
      selectedNodeType: "rule",
      selectedPatternKey: null,
      insightGroups,
      observationIndexMap: new Map([
        ["episode-2", 2],
        ["episode-3", 3],
      ]),
    });

    expect(narrative?.sourceObservations).toEqual([
      {
        graphNodeId: "episode-2",
        observationIndex: 2,
        whyItMatters: "Prevents malformed writes.",
      },
      {
        graphNodeId: "episode-3",
        observationIndex: 3,
        whyItMatters: "Prevents malformed writes.",
      },
    ]);
  });

  it("returns pattern-only rule narrative when metadata event is missing", () => {
    const narrative = resolveSelectedNarrative({
      activityEvents: [],
      selectedNodeId: "rule-missing",
      selectedNodeType: "rule" satisfies BrainNodeModel["type"],
      selectedPatternKey: "auth-token-handling",
    });

    expect(narrative).toEqual({
      thePattern: "Auth token handling",
    });
  });
});
