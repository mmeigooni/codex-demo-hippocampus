import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { ObservationRow } from "@/components/feed/ObservationRow";

function activityEvent(
  event: Partial<ActivityEventView> & Pick<ActivityEventView, "id" | "type" | "title">,
): ActivityEventView {
  return {
    raw: {},
    ...event,
  };
}

describe("ObservationRow", () => {
  it("renders an observation index badge when provided", () => {
    const html = renderToStaticMarkup(
      createElement(ObservationRow, {
        event: activityEvent({
          id: "obs-1",
          type: "episode_created",
          title: "Observed validation gap",
          graphNodeId: "episode-1",
        }),
        index: 0,
        observationIndex: 3,
      }),
    );

    expect(html).toContain("#3");
    expect(html).toContain("Observation");
  });

  it("omits observation index badge when not provided", () => {
    const html = renderToStaticMarkup(
      createElement(ObservationRow, {
        event: activityEvent({
          id: "obs-2",
          type: "episode_created",
          title: "Observed retry drift",
          graphNodeId: "episode-2",
        }),
        index: 0,
      }),
    );

    expect(html).not.toContain("#3");
    expect(html).toContain("Observation");
  });
});
