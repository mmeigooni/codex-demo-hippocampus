import { describe, expect, it } from "vitest";

import { buildGraph } from "@/app/api/graph/route";

describe("buildGraph", () => {
  it("backfills episode ruleId from linked rule", () => {
    const graph = buildGraph(
      [
        {
          id: "episode-1",
          title: "Episode one",
          salience_score: 7,
          triggers: ["cache"],
        },
      ],
      [
        {
          id: "rule-a",
          title: "Rule A",
          confidence: 0.8,
          triggers: ["cache"],
          source_episode_ids: ["episode-1"],
        },
      ],
    );

    const episodeNode = graph.nodes.find((node) => node.id === "episode-episode-1");
    expect(episodeNode?.type).toBe("episode");
    expect(episodeNode?.ruleId).toBe("rule-a");
  });

  it("keeps first linked ruleId when an episode belongs to multiple rules", () => {
    const graph = buildGraph(
      [
        {
          id: "episode-1",
          title: "Episode one",
          salience_score: 6,
          triggers: ["timing"],
        },
      ],
      [
        {
          id: "rule-a",
          title: "Rule A",
          confidence: 0.7,
          triggers: ["timing"],
          source_episode_ids: ["episode-1"],
        },
        {
          id: "rule-b",
          title: "Rule B",
          confidence: 0.9,
          triggers: ["timing"],
          source_episode_ids: ["episode-1"],
        },
      ],
    );

    const episodeNode = graph.nodes.find((node) => node.id === "episode-episode-1");
    expect(episodeNode?.ruleId).toBe("rule-a");
  });
});
