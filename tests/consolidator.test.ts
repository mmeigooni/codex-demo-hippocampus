import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("consolidation prompt"),
}));

vi.mock("@/lib/codex/client", () => ({
  createCodexThread: vi.fn(() => ({})),
  runWithSchema: vi.fn(),
}));

import { runWithSchema } from "@/lib/codex/client";
import { consolidateEpisodes, sanitizeConsolidationOutput } from "@/lib/codex/consolidator";
import type { ConsolidationEpisodeInput, ConsolidationModelOutput } from "@/lib/codex/types";

const episodes: ConsolidationEpisodeInput[] = [
  {
    id: "ep-1",
    title: "Episode One",
    what_happened: "something",
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
    const raw: ConsolidationModelOutput = {
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
    expect(sanitized.patterns[0]?.episode_ids).toEqual(["ep-1"]);
    expect(sanitized.rules_to_promote[0]?.triggers).toEqual(["retry"]);
    expect(sanitized.salience_updates[0]?.salience_score).toBe(10);
    expect(sanitized.contradictions).toHaveLength(0);
    expect(sanitized.prune_candidates).toEqual(["ep-1"]);
  });
});

describe("consolidateEpisodes", () => {
  beforeEach(() => {
    vi.mocked(runWithSchema).mockReset();
  });

  it("falls back when codex run fails", async () => {
    vi.mocked(runWithSchema).mockRejectedValueOnce(new Error("codex unavailable"));

    const result = await consolidateEpisodes({
      repoFullName: "acme/repo",
      episodes,
      existingRules: [],
    });

    expect(result.used_fallback).toBe(true);
    expect(result.patterns.length).toBeGreaterThan(0);
  });
});
