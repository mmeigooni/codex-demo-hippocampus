import { describe, expect, it } from "vitest";

import {
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
      selectedNodeId: "episode-1",
      source: "graph",
    });

    expect(result.pinnedEventId).toBe("evt-1");
    expect(result.events[0]?.id).toBe("evt-1");
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
    expect(result.events.map((event) => event.id)).toEqual(["evt-3", "evt-2"]);
  });
});
