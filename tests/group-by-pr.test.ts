import { describe, expect, it } from "vitest";

import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { groupImportActivityEvents } from "@/lib/feed/import-activity";

function event(view: Partial<ActivityEventView> & Pick<ActivityEventView, "id" | "type" | "title">): ActivityEventView {
  return {
    raw: {},
    ...view,
  };
}

describe("groupImportActivityEvents", () => {
  it("groups sequential encoding_start and episode_created events by PR", () => {
    const input: ActivityEventView[] = [
      event({ id: "pr-found", type: "pr_found", title: "found", raw: { count: 2 } }),
      event({
        id: "start-11",
        type: "encoding_start",
        title: "Encoding PR #11",
        subtitle: "Fix retry race",
        raw: { pr_number: 11, title: "Fix retry race" },
      }),
      event({
        id: "ep-11-a",
        type: "episode_created",
        title: "Episode 11a",
        salience: 6,
        graphNodeId: "episode-11-a",
        raw: { pr_number: 11, episode: { source_pr_number: 11 } },
      }),
      event({
        id: "ep-11-b",
        type: "episode_created",
        title: "Episode 11b",
        salience: 8,
        graphNodeId: "episode-11-b",
        raw: { pr_number: 11, episode: { source_pr_number: 11 } },
      }),
      event({
        id: "start-12",
        type: "encoding_start",
        title: "Encoding PR #12",
        subtitle: "Refactor stream parser",
        raw: { pr_number: 12, title: "Refactor stream parser" },
      }),
      event({
        id: "ep-12",
        type: "episode_created",
        title: "Episode 12",
        salience: 4,
        graphNodeId: "episode-12",
        raw: { pr_number: 12, episode: { source_pr_number: 12 } },
      }),
      event({ id: "complete", type: "complete", title: "done", raw: { total: 3 } }),
    ];

    const output = groupImportActivityEvents(input);

    expect(output.map((entry) => entry.type)).toEqual(["pr_found", "pr_group", "pr_group", "complete"]);

    const firstGroup = output[1]!;
    expect(firstGroup.title).toBe("PR #11: Fix retry race");
    expect(firstGroup.salience).toBe(7);
    expect(firstGroup.raw).toMatchObject({ pr_number: 11, pr_title: "Fix retry race", episode_count: 2 });
    expect(firstGroup.groupedEpisodes).toHaveLength(2);
    expect(firstGroup.graphNodeId).toBe("episode-11-a");
    expect(firstGroup.graphNodeIds).toEqual(["episode-11-a", "episode-11-b"]);
  });

  it("keeps encoding_start ungrouped when no matching episode follows", () => {
    const input: ActivityEventView[] = [
      event({ id: "start-7", type: "encoding_start", title: "Encoding PR #7", raw: { pr_number: 7, title: "Untitled" } }),
      event({ id: "error-7", type: "encoding_error", title: "failed", raw: { pr_number: 7 } }),
    ];

    const output = groupImportActivityEvents(input);

    expect(output.map((entry) => entry.type)).toEqual(["encoding_start", "encoding_error"]);
  });

  it("falls back to nested episode.source_pr_number when top-level pr_number is missing", () => {
    const input: ActivityEventView[] = [
      event({ id: "start-33", type: "encoding_start", title: "Encoding PR #33", raw: { pr_number: 33, title: "Nested" } }),
      event({
        id: "ep-33",
        type: "episode_created",
        title: "Episode 33",
        graphNodeId: "episode-33",
        raw: { episode: { source_pr_number: 33 } },
      }),
    ];

    const output = groupImportActivityEvents(input);

    expect(output).toHaveLength(1);
    expect(output[0]?.type).toBe("pr_group");
    expect(output[0]?.raw).toMatchObject({ pr_number: 33 });
  });
});
