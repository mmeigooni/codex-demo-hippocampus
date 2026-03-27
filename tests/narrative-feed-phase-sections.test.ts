import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { NarrativeFeed } from "@/components/feed/NarrativeFeed";
import type { AssociatedRuleGroup } from "@/lib/feed/association-state";
import type { NarrativeSections } from "@/lib/feed/narrative-partition";

function activityEvent(
  event: Partial<ActivityEventView> & Pick<ActivityEventView, "id" | "type" | "title">,
): ActivityEventView {
  return {
    raw: {},
    ...event,
  };
}

function makeSections({
  phase,
  withWhyItMatters,
}: {
  phase: NarrativeSections["phase"];
  withWhyItMatters: boolean;
}): NarrativeSections {
  const observation = activityEvent({
    id: "obs-1",
    type: "episode_created",
    title: "Observed validation gap",
    graphNodeId: "episode-1",
    whyItMatters: withWhyItMatters ? "Prevents malformed writes." : undefined,
  });

  const insights: AssociatedRuleGroup[] = [
    {
      ruleId: "rule-1",
      ruleTitle: "Guard payload validation",
      rulePatternKey: "input-validation",
      ruleEvent: activityEvent({
        id: "rule-evt-1",
        type: "rule_promoted",
        title: "Guard payload validation",
        graphNodeId: "rule-1",
        raw: {
          rule_id: "1",
          title: "Guard payload validation",
          rule_key: "input-validation",
        },
      }),
      episodes: [observation],
    },
  ];

  return {
    observations: [observation],
    insights,
    milestones: [],
    reasoning: null,
    phase,
  };
}

function checkmarkCount(html: string) {
  return (html.match(/stroke-width="2\.8"/g) ?? []).length;
}

describe("NarrativeFeed phase sections", () => {
  it("shows observing label when observations collapse after observing phase", () => {
    const html = renderToStaticMarkup(
      createElement(NarrativeFeed, {
        sections: makeSections({ phase: "analyzing", withWhyItMatters: false }),
      }),
    );

    expect(html).toContain("Code Reviews");
    expect(html).toContain("1 code reviews observed");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Patterns Discovered");
  });

  it("marks connecting complete once why-it-matters content is present", () => {
    const html = renderToStaticMarkup(
      createElement(NarrativeFeed, {
        sections: makeSections({ phase: "connecting", withWhyItMatters: true }),
      }),
    );

    expect(checkmarkCount(html)).toBe(3);
    expect(html).not.toContain("bg-cyan-400/10");
    expect(html).toContain("1 insights determined");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Guard payload validation");
  });

  it("shows why-it-matters collapsed grouping when insight rows exist", () => {
    const html = renderToStaticMarkup(
      createElement(NarrativeFeed, {
        sections: makeSections({ phase: "connecting", withWhyItMatters: false }),
      }),
    );

    expect(checkmarkCount(html)).toBe(3);
    expect(html).not.toContain("bg-cyan-400/10");
    expect(html).toContain("1 insights determined");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Guard payload validation");
    expect(html).not.toContain("Prevents malformed writes.");
  });
});
