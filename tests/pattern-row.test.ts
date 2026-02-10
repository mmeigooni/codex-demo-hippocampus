import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { PatternRow } from "@/components/feed/PatternRow";

function activityEvent(
  event: Partial<ActivityEventView> & Pick<ActivityEventView, "id" | "type" | "title">,
): ActivityEventView {
  return {
    raw: {},
    ...event,
  };
}

describe("PatternRow", () => {
  it("renders Pattern label, summary, and connected observation dots", () => {
    const html = renderToStaticMarkup(
      createElement(PatternRow, {
        event: activityEvent({
          id: "milestone-1",
          type: "pattern_detected",
          title: "Pattern detected",
          raw: {
            summary: "Validation drift repeated across services",
            episode_ids: ["ep-1", "ep-3", "ep-5"],
          },
        }),
        observationIndexMap: new Map([
          ["episode-ep-1", 1],
          ["episode-ep-3", 3],
          ["episode-ep-5", 5],
        ]),
        index: 0,
      }),
    );

    expect(html).toContain("Pattern");
    expect(html).toContain("Validation drift repeated across services");
    expect(html).toContain("#1");
    expect(html).toContain("#3");
    expect(html).toContain("#5");
  });

  it("falls back to subtitle and skips dots when no episode IDs map", () => {
    const html = renderToStaticMarkup(
      createElement(PatternRow, {
        event: activityEvent({
          id: "milestone-2",
          type: "pattern_detected",
          title: "Pattern detected: Retry handling",
          subtitle: "2 related episodes",
          raw: {
            episode_ids: ["ep-missing-1", "ep-missing-2"],
          },
        }),
        observationIndexMap: new Map(),
        index: 1,
      }),
    );

    expect(html).toContain("2 related episodes");
    expect(html).not.toContain("#1");
    expect(html).not.toContain("#2");
  });
});
