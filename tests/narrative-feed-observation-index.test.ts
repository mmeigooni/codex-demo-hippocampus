import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { NarrativeFeed } from "@/components/feed/NarrativeFeed";
import type { NarrativeSections } from "@/lib/feed/narrative-partition";

function activityEvent(
  event: Partial<ActivityEventView> & Pick<ActivityEventView, "id" | "type" | "title">,
): ActivityEventView {
  return {
    raw: {},
    ...event,
  };
}

describe("NarrativeFeed observation indexing", () => {
  it("uses a consistent observation index map for observation rows and pattern dots", () => {
    const observationA = activityEvent({
      id: "obs-a",
      type: "episode_created",
      title: "Observed validation gap",
      graphNodeId: "episode-a",
    });
    const observationB = activityEvent({
      id: "obs-b",
      type: "episode_created",
      title: "Observed retry drift",
      graphNodeId: "episode-b",
    });
    const observationARepeat = activityEvent({
      id: "obs-a-repeat",
      type: "episode_created",
      title: "Observed validation gap again",
      graphNodeId: "episode-a",
    });

    const baseSections: NarrativeSections = {
      observations: [observationA, observationB, observationARepeat],
      insights: [],
      milestones: [
        activityEvent({
          id: "pattern-1",
          type: "pattern_detected",
          title: "Pattern detected",
          raw: {
            summary: "Validation drift pattern",
            episode_ids: ["a", "b", "missing"],
          },
        }),
      ],
      reasoning: null,
      phase: "observing",
    };

    const observationHtml = renderToStaticMarkup(createElement(NarrativeFeed, { sections: baseSections }));
    const hashOneCount = (observationHtml.match(/#1/g) ?? []).length;

    expect(observationHtml).toContain("#1");
    expect(observationHtml).toContain("#2");
    expect(hashOneCount).toBeGreaterThanOrEqual(2);

    const patternHtml = renderToStaticMarkup(
      createElement(NarrativeFeed, { sections: { ...baseSections, phase: "analyzing" } }),
    );

    expect(patternHtml).toContain("Validation drift pattern");
    expect(patternHtml).toContain("Pattern");
    expect(patternHtml).toContain("#1");
    expect(patternHtml).toContain("#2");
    expect(patternHtml).not.toContain("#3");
  });
});
