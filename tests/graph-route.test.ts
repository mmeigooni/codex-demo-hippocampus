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
          pattern_key: "retry-strategy",
        },
      ],
      [
        {
          id: "rule-a",
          title: "Rule A",
          confidence: 0.8,
          triggers: ["cache"],
          source_episode_ids: ["episode-1"],
          rule_key: "retry-strategy",
        },
      ],
    );

    const episodeNode = graph.nodes.find((node) => node.id === "episode-episode-1");
    expect(episodeNode?.type).toBe("episode");
    expect(episodeNode?.patternKey).toBe("retry-strategy");
    expect(episodeNode?.ruleId).toBe("rule-a");

    const ruleNode = graph.nodes.find((node) => node.id === "rule-rule-a");
    expect(ruleNode?.patternKey).toBe("retry-strategy");
  });

  it("keeps first linked ruleId when an episode belongs to multiple rules", () => {
    const graph = buildGraph(
      [
        {
          id: "episode-1",
          title: "Episode one",
          salience_score: 6,
          triggers: ["timing"],
          pattern_key: "state-transition",
        },
      ],
      [
        {
          id: "rule-a",
          title: "Rule A",
          confidence: 0.7,
          triggers: ["timing"],
          source_episode_ids: ["episode-1"],
          rule_key: "state-transition",
        },
        {
          id: "rule-b",
          title: "Rule B",
          confidence: 0.9,
          triggers: ["timing"],
          source_episode_ids: ["episode-1"],
          rule_key: "state-transition",
        },
      ],
    );

    const episodeNode = graph.nodes.find((node) => node.id === "episode-episode-1");
    expect(episodeNode?.ruleId).toBe("rule-a");
  });

  it("falls back to review-hygiene when graph records contain invalid keys", () => {
    const graph = buildGraph(
      [
        {
          id: "episode-x",
          title: "Episode X",
          salience_score: 4,
          triggers: [],
          pattern_key: "not-a-pattern",
        },
      ],
      [
        {
          id: "rule-x",
          title: "Rule X",
          confidence: 0.2,
          triggers: [],
          source_episode_ids: ["episode-x"],
          rule_key: "invalid-rule-key",
        },
      ],
    );

    const episodeNode = graph.nodes.find((node) => node.id === "episode-episode-x");
    const ruleNode = graph.nodes.find((node) => node.id === "rule-rule-x");
    expect(episodeNode?.patternKey).toBe("review-hygiene");
    expect(ruleNode?.patternKey).toBe("review-hygiene");
  });
});
