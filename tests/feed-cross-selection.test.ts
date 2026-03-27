import { describe, expect, it } from "vitest";

import {
  activityEventMatchesNodeId,
  buildFeedRenderWindow,
  graphNodeIdFromConsolidationEvent,
  graphNodeIdFromImportEvent,
} from "@/lib/feed/cross-selection";

describe("cross selection helpers", () => {
  it("extracts episode node IDs from import events", () => {
    const nodeId = graphNodeIdFromImportEvent({
      type: "episode_created",
      data: {
        episode: {
          id: "ep-1",
        },
      },
    });

    expect(nodeId).toBe("episode-ep-1");
  });

  it("extracts rule and episode IDs from consolidation events", () => {
    const ruleNodeId = graphNodeIdFromConsolidationEvent({
      type: "rule_promoted",
      data: {
        rule_id: "rule-42",
      },
    });

    const episodeNodeId = graphNodeIdFromConsolidationEvent({
      type: "salience_updated",
      data: {
        episode_id: "episode-9",
      },
    });

    expect(ruleNodeId).toBe("rule-rule-42");
    expect(episodeNodeId).toBe("episode-episode-9");
  });

  it("matches selected node IDs against both graphNodeId and graphNodeIds", () => {
    const directMatch = activityEventMatchesNodeId({ id: "evt-1", graphNodeId: "episode-1" }, "episode-1");
    const groupedMatch = activityEventMatchesNodeId(
      { id: "evt-2", graphNodeIds: ["episode-2", "episode-3"] },
      "episode-3",
    );
    const noMatch = activityEventMatchesNodeId({ id: "evt-3", graphNodeIds: ["episode-4"] }, "episode-9");

    expect(directMatch).toBe(true);
    expect(groupedMatch).toBe(true);
    expect(noMatch).toBe(false);
  });

  it("injects and pins selected graph event when it is outside the visible window", () => {
    const events = [
      { id: "evt-1", graphNodeId: "episode-1" },
      { id: "evt-2", graphNodeId: "episode-2" },
      { id: "evt-3", graphNodeId: "episode-3" },
      { id: "evt-4", graphNodeId: "episode-4" },
    ];

    const result = buildFeedRenderWindow({
      events,
      maxItems: 2,
      selectedNodeId: "episode-4",
      source: "graph",
    });

    expect(result.pinnedEventId).toBe("evt-4");
    expect(result.events[0]?.id).toBe("evt-4");
    expect(result.events).toHaveLength(2);
  });

  it("does not pin when the selection source is feed", () => {
    const events = [
      { id: "evt-1", graphNodeId: "episode-1" },
      { id: "evt-2", graphNodeId: "episode-2" },
      { id: "evt-3", graphNodeId: "episode-3" },
    ];

    const result = buildFeedRenderWindow({
      events,
      maxItems: 2,
      selectedNodeId: "episode-1",
      source: "feed",
    });

    expect(result.pinnedEventId).toBeNull();
    expect(result.events.map((event) => event.id)).toEqual(["evt-1", "evt-2"]);
  });

  it("pins grouped events when selected node is inside graphNodeIds", () => {
    const events = [
      { id: "evt-1", graphNodeId: "episode-1" },
      { id: "evt-3", graphNodeId: "episode-4" },
      { id: "evt-2", graphNodeIds: ["episode-2", "episode-3"] },
      { id: "evt-4", graphNodeId: "episode-5" },
    ];

    const result = buildFeedRenderWindow({
      events,
      maxItems: 2,
      selectedNodeId: "episode-2",
      source: "graph",
    });

    expect(result.pinnedEventId).toBe("evt-2");
    expect(result.events[0]?.id).toBe("evt-2");
  });
});
