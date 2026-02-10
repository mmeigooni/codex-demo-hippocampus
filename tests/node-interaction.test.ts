import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NodeInteraction } from "@/components/brain/NodeInteraction";
import type { PositionedBrainNode } from "@/components/brain/types";

function positionedNode(node: Partial<PositionedBrainNode> & Pick<PositionedBrainNode, "id" | "label" | "type">) {
  return {
    salience: 6,
    triggers: [],
    patternKey: "review-hygiene",
    position: [0, 0, 0] as [number, number, number],
    ...node,
  } satisfies PositionedBrainNode;
}

describe("NodeInteraction", () => {
  it("renders the empty placeholder when node is null", () => {
    const html = renderToStaticMarkup(createElement(NodeInteraction, { node: null }));

    expect(html).toContain("Hover or click a node to inspect episode/rule context.");
  });

  it("renders episode narrative sections in order when narrative fields exist", () => {
    const node = positionedNode({
      id: "episode-1",
      type: "episode",
      label: "Episode one",
      patternKey: "input-validation",
    });

    const html = renderToStaticMarkup(
      createElement(NodeInteraction, {
        node,
        narrative: {
          whatHappened: "A null payload bypassed validation.",
          thePattern: "Input validation",
          theFix: "Added schema checks in the request layer.",
          whyItMatters: "Prevents malformed writes.",
        },
      }),
    );

    const expectedOrder = ["What Happened", "The Pattern", "The Fix", "Why It Matters"];
    for (const sectionLabel of expectedOrder) {
      expect(html).toContain(sectionLabel);
    }
    expect(html).toContain("A null payload bypassed validation.");
    expect(html).toContain("Added schema checks in the request layer.");
  });

  it("renders rule hybrid fallback details including confidence and observation count", () => {
    const node = positionedNode({
      id: "rule-1",
      type: "rule",
      label: "Guard input validation",
      patternKey: "input-validation",
      salience: 8,
      triggers: ["payload", "validation"],
    });

    const html = renderToStaticMarkup(
      createElement(NodeInteraction, {
        node,
        narrative: {
          thePattern: "Input validation",
          whyItMatters: "Stops malformed payloads early.",
          ruleConfidence: 0.82,
          ruleEpisodeCount: 3,
        },
      }),
    );

    expect(html).toContain("Pattern strength");
    expect(html).toContain("82%");
    expect(html).toContain("Based on 3 observations");
    expect(html).toContain("Why it matters:");
    expect(html).toContain("payload");
    expect(html).toContain("validation");
  });
});
