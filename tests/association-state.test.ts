import { describe, expect, it } from "vitest";

import type { ActivityEventView } from "@/components/feed/ActivityCard";
import {
  applyRulePromotedEvent,
  groupAssociatedByRule,
  partitionFeedEvents,
  type AssociationMap,
} from "@/lib/feed/association-state";

function event(
  view: Partial<ActivityEventView> & Pick<ActivityEventView, "id" | "type" | "title">,
): ActivityEventView {
  return {
    raw: {},
    ...view,
  };
}

describe("applyRulePromotedEvent", () => {
  it("maps source episodes to a promoted rule", () => {
    const current: AssociationMap = new Map([["episode-existing", "rule-existing"]]);

    const next = applyRulePromotedEvent(current, {
      rule_id: "rule-42",
      source_episode_ids: ["ep-1", "ep-2"],
    });

    expect(next).not.toBe(current);
    expect(next.get("episode-ep-1")).toBe("rule-rule-42");
    expect(next.get("episode-ep-2")).toBe("rule-rule-42");
    expect(next.get("episode-existing")).toBe("rule-existing");
  });

  it("returns the same map reference for invalid payloads", () => {
    const current: AssociationMap = new Map([["episode-ep-1", "rule-r1"]]);

    const missingRule = applyRulePromotedEvent(current, {
      source_episode_ids: ["ep-2"],
    });
    const missingEpisodes = applyRulePromotedEvent(current, {
      rule_id: "r2",
      source_episode_ids: "ep-2",
    });

    expect(missingRule).toBe(current);
    expect(missingEpisodes).toBe(current);
  });

  it("remaps episodes when a newer rule promotion claims them", () => {
    const current: AssociationMap = new Map([
      ["episode-ep-1", "rule-old"],
      ["episode-ep-2", "rule-old"],
    ]);

    const next = applyRulePromotedEvent(current, {
      rule_id: "new",
      source_episode_ids: ["ep-1"],
    });

    expect(next.get("episode-ep-1")).toBe("rule-new");
    expect(next.get("episode-ep-2")).toBe("rule-old");
  });
});

describe("partitionFeedEvents", () => {
  it("splits associated events while keeping meta events unassociated", () => {
    const associations: AssociationMap = new Map([
      ["episode-ep-1", "rule-r1"],
      ["episode-ep-2", "rule-r2"],
    ]);

    const events: ActivityEventView[] = [
      event({ id: "bootstrap", type: "import_bootstrap", title: "bootstrap" }),
      event({
        id: "ep-1",
        type: "episode_created",
        title: "Episode 1",
        graphNodeId: "episode-ep-1",
      }),
      event({
        id: "salience",
        type: "salience_updated",
        title: "Salience",
        graphNodeId: "episode-ep-1",
      }),
      event({
        id: "pr-group",
        type: "pr_group",
        title: "PR Group",
        graphNodeIds: ["episode-ep-2", "episode-ep-3"],
      }),
      event({
        id: "rule-promoted",
        type: "rule_promoted",
        title: "Rule promoted: R1",
      }),
      event({
        id: "reasoning",
        type: "reasoning",
        title: "Reasoning",
        variant: "reasoning",
      }),
      event({
        id: "ep-3",
        type: "episode_created",
        title: "Episode 3",
        graphNodeId: "episode-ep-3",
      }),
    ];

    const result = partitionFeedEvents(events, associations);

    expect(result.associated.map((entry) => entry.id)).toEqual(["ep-1", "pr-group", "rule-promoted"]);
    expect(result.unassociated.map((entry) => entry.id)).toEqual(["bootstrap", "salience", "reasoning", "ep-3"]);
  });
});

describe("groupAssociatedByRule", () => {
  it("groups by first-seen rule order and hydrates rule metadata", () => {
    const associations: AssociationMap = new Map([
      ["episode-ep-1", "rule-a"],
      ["episode-ep-2", "rule-b"],
      ["episode-ep-3", "rule-a"],
    ]);

    const associatedEvents: ActivityEventView[] = [
      event({
        id: "ep-1",
        type: "episode_created",
        title: "Episode 1",
        graphNodeId: "episode-ep-1",
      }),
      event({
        id: "rule-b-event",
        type: "rule_promoted",
        title: "Rule promoted: Rule B",
        raw: { rule_id: "b", title: "Rule B", rule_key: "retry-strategy" },
      }),
      event({
        id: "ep-2",
        type: "episode_created",
        title: "Episode 2",
        graphNodeId: "episode-ep-2",
      }),
      event({
        id: "rule-a-event",
        type: "rule_promoted",
        title: "Rule promoted: Rule A",
        raw: { rule_id: "a", title: "Rule A", rule_key: "input-validation" },
      }),
      event({
        id: "ep-3",
        type: "episode_created",
        title: "Episode 3",
        graphNodeId: "episode-ep-3",
      }),
    ];

    const groups = groupAssociatedByRule(associatedEvents, associations);

    expect(groups.map((group) => group.ruleId)).toEqual(["rule-a", "rule-b"]);

    expect(groups[0]?.ruleTitle).toBe("Rule A");
    expect(groups[0]?.rulePatternKey).toBe("input-validation");
    expect(groups[0]?.ruleEvent?.id).toBe("rule-a-event");
    expect(groups[0]?.episodes.map((episode) => episode.id)).toEqual(["ep-1", "ep-3"]);

    expect(groups[1]?.ruleTitle).toBe("Rule B");
    expect(groups[1]?.rulePatternKey).toBe("retry-strategy");
    expect(groups[1]?.ruleEvent?.id).toBe("rule-b-event");
    expect(groups[1]?.episodes.map((episode) => episode.id)).toEqual(["ep-2"]);
  });
});
