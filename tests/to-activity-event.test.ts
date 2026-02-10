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
          the_pattern: "sensitive-logging",
          triggers: ["timeout"],
          what_happened: "Error paths skipped retry backoff",
          the_fix: "Centralized retry policy and guardrails",
          why_it_matters: "Prevents user-visible failures",
        },
      },
    };

    const activity = toImportActivityEvent(event, 0);

    expect(activity?.type).toBe("episode_created");
    expect(activity?.whatHappened).toBe("Error paths skipped retry backoff");
    expect(activity?.theFix).toBe("Centralized retry policy and guardrails");
    expect(activity?.whyItMatters).toBe("Prevents user-visible failures");
    expect(activity?.subtitle).toBe("Sensitive logging");
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

  it("falls back to a normalized subtitle when pattern key is unknown", () => {
    const event: ImportEvent = {
      type: "episode_created",
      data: {
        pr_number: 23,
        episode: {
          id: "ep-23",
          title: "Episode 23",
          salience_score: 3,
          the_pattern: "custom-risk-pattern",
          triggers: [],
        },
      },
    };

    const activity = toImportActivityEvent(event, 3);
    expect(activity?.subtitle).toBe("Custom Risk Pattern");
  });

  it("maps snippets_extracted to explicit import progress activity", () => {
    const event: ImportEvent = {
      type: "snippets_extracted",
      data: {
        pr_number: 12,
        snippet_count: 7,
        file_count: 3,
        search_rule_count: 2,
      },
    };

    const activity = toImportActivityEvent(event, 5);

    expect(activity?.type).toBe("snippets_extracted");
    expect(activity?.title).toBe("Extracted 7 snippets from 3 files");
    expect(activity?.subtitle).toBe("2 search rules applied");
    expect(activity?.variant).toBe("import");
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
