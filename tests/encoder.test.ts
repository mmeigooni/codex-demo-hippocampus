import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("encode prompt"),
}));

vi.mock("@/lib/codex/client", () => ({
  createCodexThread: vi.fn(() => ({})),
  runWithSchema: vi.fn(),
}));

import { runWithSchema } from "@/lib/codex/client";
import { encodeEpisode, EpisodeEncodingError } from "@/lib/codex/encoder";
import type { EpisodeEncodingInput } from "@/lib/codex/types";

const input: EpisodeEncodingInput = {
  owner: "acme",
  repo: "shopflow",
  pr: {
    id: 1,
    number: 42,
    title: "Fix retries",
    body: "",
    authorLogin: "dev1",
    htmlUrl: "https://example.com/pr/42",
    state: "closed",
    mergedAt: "2026-02-08T00:00:00.000Z",
    createdAt: "2026-02-07T00:00:00.000Z",
    updatedAt: "2026-02-08T00:00:00.000Z",
    additions: 10,
    deletions: 2,
    changedFiles: 1,
  },
  reviews: [
    {
      id: 100,
      body: "Please avoid unbounded retries",
      state: "COMMENTED",
      submittedAt: "2026-02-08T00:00:00.000Z",
      authorLogin: "reviewer",
      comments: [
        {
          id: 500,
          reviewId: 100,
          body: "Need backoff",
          authorLogin: "reviewer",
          path: "payments.ts",
          line: 12,
          side: "RIGHT",
          commitId: "abc",
          createdAt: "2026-02-08T00:00:00.000Z",
          updatedAt: "2026-02-08T00:00:00.000Z",
        },
      ],
    },
  ],
  snippets: ["retryPayment(orderId)"],
};

describe("encodeEpisode", () => {
  beforeEach(() => {
    vi.mocked(runWithSchema).mockReset();
  });

  it("normalizes salience and triggers from schema output", async () => {
    vi.mocked(runWithSchema).mockResolvedValueOnce({
      what_happened: "Retries were unbounded",
      the_pattern: "unbounded-retry",
      the_fix: "Add capped retry backoff",
      why_it_matters: "Protects downstream providers",
      salience_score: 14,
      triggers: ["Retry", "retry", " payments "],
    });

    const result = await encodeEpisode(input);

    expect(result.episode.salience_score).toBe(10);
    expect(result.episode.triggers).toEqual(["retry", "payments"]);
    expect(result.episode.pattern_key).toBe("retry-strategy");
    expect(result.episode.the_pattern).toBe("Retry strategy");
    expect(result.reviewCount).toBe(1);
    expect(result.snippetCount).toBe(1);
  });

  it("throws a typed error when codex run fails", async () => {
    vi.mocked(runWithSchema).mockRejectedValueOnce(new Error("codex timeout"));

    await expect(encodeEpisode(input)).rejects.toBeInstanceOf(EpisodeEncodingError);
  });
});
