import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("consolidation prompt"),
}));

vi.mock("@/lib/codex/client", () => ({
  createCodexThread: vi.fn(() => ({})),
  runWithSchema: vi.fn(),
  runStreamedWithSchema: vi.fn(),
}));

import { runStreamedWithSchema, runWithSchema } from "@/lib/codex/client";
import { consolidateEpisodes, sanitizeConsolidationOutput } from "@/lib/codex/consolidator";
import type { ConsolidationEpisodeInput } from "@/lib/codex/types";

const episodes: ConsolidationEpisodeInput[] = [
  {
    id: "ep-1",
    title: "Episode One",
    what_happened: "something",
    pattern_key: "retry-strategy",
    the_pattern: "retry-loop",
    the_fix: "backoff",
    why_it_matters: "stability",
    salience_score: 7,
    triggers: ["retry", "payments"],
    source_pr_number: 12,
    source_url: "https://example.com/pr/12",
  },
  {
    id: "ep-2",
    title: "Episode Two",
    what_happened: "another",
    pattern_key: "retry-strategy",
    the_pattern: "retry-loop",
    the_fix: "limit",
    why_it_matters: "cost",
    salience_score: 5,
    triggers: ["retry"],
    source_pr_number: 13,
    source_url: "https://example.com/pr/13",
  },
];

describe("sanitizeConsolidationOutput", () => {
  it("filters invalid references and deduplicates entities", () => {
    const raw = {
      patterns: [
        { name: "retry-loop", summary: "valid", episode_ids: ["ep-1", "missing"] },
      ],
      rules_to_promote: [
        {
          title: " Guard retry logic ",
          description: " keep retries bounded ",
          triggers: ["Retry", "retry", " "],
          source_episode_ids: ["ep-1", "missing"],
        },
      ],
      contradictions: [
        { left_episode_id: "ep-1", right_episode_id: "ep-1", reason: "invalid" },
      ],
      salience_updates: [
        { episode_id: "ep-1", salience_score: 11, reason: "important" },
      ],
      prune_candidates: ["ep-1", "missing"],
    };

    const sanitized = sanitizeConsolidationOutput(raw, episodes);

    expect(sanitized.patterns).toHaveLength(1);
    expect(sanitized.patterns[0]?.episode_ids).toEqual(["ep-1", "ep-2"]);
    expect(sanitized.rules_to_promote[0]?.rule_key).toBe("retry-strategy");
    expect(sanitized.rules_to_promote[0]?.source_episode_ids).toEqual(["ep-1", "ep-2"]);
    expect(sanitized.rules_to_promote[0]?.triggers).toContain("retry");
    expect(sanitized.salience_updates[0]?.salience_score).toBe(10);
    expect(sanitized.contradictions).toHaveLength(0);
    expect(sanitized.prune_candidates).toEqual(["ep-1"]);
  });

  it("enforces minimum support of 2 episodes per promoted rule key", () => {
    const singletonEpisodes: ConsolidationEpisodeInput[] = [
      {
        id: "ep-3",
        title: "Single Episode",
        what_happened: "one off",
        pattern_key: "auth-token-handling",
        the_pattern: "token forwarding",
        the_fix: "redact token",
        why_it_matters: "security",
        salience_score: 8,
        triggers: ["token"],
        source_pr_number: 14,
        source_url: "https://example.com/pr/14",
      },
    ];

    const sanitized = sanitizeConsolidationOutput(
      {
        patterns: [],
        rules_to_promote: [
          {
            title: "Stop token forwarding",
            description: "Do not propagate bearer tokens",
            triggers: ["token", "bearer"],
            source_episode_ids: ["ep-3"],
          },
        ],
        contradictions: [],
        salience_updates: [],
        prune_candidates: [],
      },
      singletonEpisodes,
    );

    expect(sanitized.rules_to_promote).toHaveLength(0);
  });
});

describe("consolidateEpisodes", () => {
  beforeEach(() => {
    vi.mocked(runWithSchema).mockReset();
    vi.mocked(runStreamedWithSchema).mockReset();
  });

  it("throws when codex run fails", async () => {
    vi.mocked(runWithSchema).mockRejectedValueOnce(new Error("codex unavailable"));

    await expect(
      consolidateEpisodes({
        repoFullName: "acme/repo",
        episodes,
        existingRules: [],
      }),
    ).rejects.toThrow("codex unavailable");
  });

  it("uses streamed schema run when stream callbacks are provided", async () => {
    const rawOutput = {
      patterns: [{ name: "retry", summary: "retry pattern", episode_ids: ["ep-1", "ep-2"] }],
      rules_to_promote: [
        {
          title: "Guard retries",
          description: "Bound retries",
          triggers: ["retry", "limits"],
          source_episode_ids: ["ep-1", "ep-2"],
        },
      ],
      contradictions: [],
      salience_updates: [{ episode_id: "ep-1", salience_score: 9, reason: "frequent" }],
      prune_candidates: [],
    };

    vi.mocked(runStreamedWithSchema).mockImplementationOnce(async (_thread, _prompt, _schema, callbacks) => {
      callbacks?.onReasoningStart?.("reasoning-id", "start");
      callbacks?.onReasoningDelta?.("reasoning-id", "start + delta");
      callbacks?.onReasoningComplete?.("reasoning-id", "done");
      callbacks?.onResponseStart?.("response-id", "{");
      callbacks?.onResponseDelta?.("response-id", '{"patterns":');
      return rawOutput;
    });

    const onReasoningStart = vi.fn();
    const onReasoningDelta = vi.fn();
    const onReasoningComplete = vi.fn();
    const onResponseStart = vi.fn();
    const onResponseDelta = vi.fn();

    const result = await consolidateEpisodes(
      {
        repoFullName: "acme/repo",
        episodes,
        existingRules: [],
      },
      {
        onReasoningStart,
        onReasoningDelta,
        onReasoningComplete,
        onResponseStart,
        onResponseDelta,
      },
    );

    expect(runStreamedWithSchema).toHaveBeenCalledTimes(1);
    expect(runWithSchema).not.toHaveBeenCalled();
    expect(onReasoningStart).toHaveBeenCalledWith("start");
    expect(onReasoningDelta).toHaveBeenCalledWith("start + delta");
    expect(onReasoningComplete).toHaveBeenCalledWith("done");
    expect(onResponseStart).toHaveBeenCalledWith("{");
    expect(onResponseDelta).toHaveBeenCalledWith('{"patterns":');
    expect(result.used_fallback).toBe(false);
    expect(result.patterns).toHaveLength(1);
  });
});
