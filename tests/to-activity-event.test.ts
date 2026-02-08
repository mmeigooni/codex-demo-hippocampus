import { describe, expect, it } from "vitest";

import { toImportActivityEvent } from "@/lib/feed/import-activity";
import type { ImportEvent } from "@/lib/github/types";

describe("toImportActivityEvent", () => {
  it("maps why_it_matters onto whyItMatters when present", () => {
    const event: ImportEvent = {
      type: "episode_created",
      data: {
        pr_number: 44,
        episode: {
          id: "ep-44",
          title: "Episode 44",
          salience_score: 8,
          the_pattern: "latency",
          triggers: ["timeout"],
          why_it_matters: "Prevents user-visible failures",
        },
      },
    };

    const activity = toImportActivityEvent(event, 0);

    expect(activity?.type).toBe("episode_created");
    expect(activity?.whyItMatters).toBe("Prevents user-visible failures");
    expect(activity?.graphNodeId).toBe("episode-ep-44");
    expect(activity?.raw).toMatchObject({ pr_number: 44 });
  });

  it("leaves whyItMatters undefined when field is absent", () => {
    const event: ImportEvent = {
      type: "episode_created",
      data: {
        pr_number: 12,
        episode: {
          id: "ep-12",
          title: "Episode 12",
          salience_score: 5,
          the_pattern: "retry",
          triggers: ["network"],
        },
      },
    };

    const activity = toImportActivityEvent(event, 1);

    expect(activity?.whyItMatters).toBeUndefined();
  });

  it("drops replay manifests from activity feed", () => {
    const event: ImportEvent = {
      type: "replay_manifest",
      data: {
        mode: "import_replay",
      },
    };

    const activity = toImportActivityEvent(event, 2);

    expect(activity).toBeNull();
  });
});
