import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseJsonSseBuffer } from "@/lib/sse/parse";

const mockCreateServerClient = vi.hoisted(() => vi.fn());
const mockResolveStorageModeAfterProfilesPreflight = vi.hoisted(() => vi.fn());
const mockFetchRepo = vi.hoisted(() => vi.fn());
const mockFetchMergedPRs = vi.hoisted(() => vi.fn());
const mockFetchPRReviews = vi.hoisted(() => vi.fn());
const mockFetchPRDiff = vi.hoisted(() => vi.fn());
const mockEncodeEpisode = vi.hoisted(() => vi.fn());
const mockGenerateSearchRules = vi.hoisted(() => vi.fn());
const mockExecuteSearch = vi.hoisted(() => vi.fn());
const mockSummarizeTokenReduction = vi.hoisted(() => vi.fn());
const mockUpsertRepoForUser = vi.hoisted(() => vi.fn());
const mockListEpisodesForRepo = vi.hoisted(() => vi.fn());
const mockInsertEpisodeForRepo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock("@/lib/supabase/schema-guard", () => ({
  resolveStorageModeAfterProfilesPreflight: mockResolveStorageModeAfterProfilesPreflight,
  isProfilesSchemaNotReadyError: () => false,
  SCHEMA_NOT_READY_PROFILES_CODE: "SCHEMA_NOT_READY_PROFILES",
}));

vi.mock("@/lib/github/client", () => ({
  fetchRepo: mockFetchRepo,
  fetchMergedPRs: mockFetchMergedPRs,
  fetchPRReviews: mockFetchPRReviews,
  fetchPRDiff: mockFetchPRDiff,
}));

vi.mock("@/lib/codex/encoder", () => ({
  encodeEpisode: mockEncodeEpisode,
}));

vi.mock("@/lib/codex/search", () => ({
  generateSearchRules: mockGenerateSearchRules,
  executeSearch: mockExecuteSearch,
  summarizeTokenReduction: mockSummarizeTokenReduction,
}));

vi.mock("@/lib/fallback/runtime-memory-store", () => ({
  upsertRepoForUser: mockUpsertRepoForUser,
  listEpisodesForRepo: mockListEpisodesForRepo,
  insertEpisodeForRepo: mockInsertEpisodeForRepo,
}));

import { POST } from "@/app/api/github/import/route";

const BASE_PRS = [
  {
    id: 1,
    number: 101,
    title: "Replay PR one",
    body: "",
    authorLogin: "dev",
    htmlUrl: "https://example.com/pr/101",
    state: "closed",
    mergedAt: "2026-02-01T00:00:00.000Z",
    createdAt: "2026-01-31T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    additions: 10,
    deletions: 2,
    changedFiles: 1,
  },
  {
    id: 2,
    number: 102,
    title: "Replay PR two",
    body: "",
    authorLogin: "dev",
    htmlUrl: "https://example.com/pr/102",
    state: "closed",
    mergedAt: "2026-02-02T00:00:00.000Z",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
    additions: 20,
    deletions: 4,
    changedFiles: 2,
  },
];

function createSupabaseAuthMock() {
  return {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "user-1",
            user_metadata: { user_name: "acme-dev", avatar_url: "https://example.com/avatar.png" },
          },
        },
      }),
      getSession: async () => ({
        data: {
          session: null,
        },
      }),
    },
  };
}

async function parseImportEvents(response: Response) {
  const body = await response.text();
  const normalized = body.endsWith("\n\n") ? body : `${body}\n\n`;
  const parsed = parseJsonSseBuffer(normalized);
  return parsed.events as Array<{ type: string; data: Record<string, unknown> }>;
}

beforeEach(() => {
  vi.clearAllMocks();

  mockCreateServerClient.mockResolvedValue(createSupabaseAuthMock());
  mockResolveStorageModeAfterProfilesPreflight.mockResolvedValue("memory-fallback");
  mockFetchRepo.mockResolvedValue({ private: false });
  mockFetchPRReviews.mockResolvedValue([]);
  mockFetchPRDiff.mockResolvedValue("diff --git a/file.ts b/file.ts");
  mockGenerateSearchRules.mockResolvedValue({ search_rules: [] });
  mockExecuteSearch.mockReturnValue([]);
  mockSummarizeTokenReduction.mockReturnValue({
    reductionRatio: 0,
    rawTokens: 100,
    reducedTokens: 100,
  });
  mockUpsertRepoForUser.mockReturnValue({ id: "repo-1" });
  mockEncodeEpisode.mockResolvedValue({
    episode: {
      source_pr_number: 999,
      title: "Encoded Episode",
      who: "dev",
      what_happened: "something",
      pattern_key: "review-hygiene",
      the_pattern: "pattern",
      the_fix: "fix",
      why_it_matters: "matters",
      salience_score: 5,
      triggers: ["tests"],
      source_url: "https://example.com",
      happened_at: "2026-02-01T00:00:00.000Z",
    },
    narrative: {
      what_happened: "something",
      the_pattern: "pattern",
      the_fix: "fix",
      why_it_matters: "matters",
      salience_score: 5,
      triggers: ["tests"],
    },
    reviewCount: 0,
    snippetCount: 0,
  });
  mockInsertEpisodeForRepo.mockImplementation((_repoId: string, payload: { source_pr_number: number; title: string }) => ({
    id: `episode-${payload.source_pr_number}`,
    title: payload.title,
    source_pr_number: payload.source_pr_number,
    salience_score: 5,
    pattern_key: "review-hygiene",
    the_pattern: "pattern",
    triggers: ["tests"],
  }));
});

describe("POST /api/github/import replay detection", () => {
  it("emits replay manifest and cached episode_created events when all PRs are cached", async () => {
    mockFetchMergedPRs.mockResolvedValue(BASE_PRS);
    mockListEpisodesForRepo.mockReturnValue([
      {
        id: "ep-101",
        source_pr_number: 101,
        title: "Cached 101",
        salience_score: 7,
        pattern_key: "review-hygiene",
        the_pattern: "cached-pattern",
        triggers: ["cache"],
      },
      {
        id: "ep-102",
        source_pr_number: 102,
        title: "Cached 102",
        salience_score: 6,
        pattern_key: "review-hygiene",
        the_pattern: "cached-pattern",
        triggers: ["cache"],
      },
    ]);

    const response = await POST(
      new Request("http://localhost/api/github/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ owner: "acme", repo: "demo" }),
      }),
    );

    expect(response.status).toBe(200);
    const events = await parseImportEvents(response);
    const types = events.map((event) => event.type);

    expect(types).toContain("replay_manifest");
    expect(types.filter((type) => type === "episode_created")).toHaveLength(2);
    expect(types).not.toContain("episode_skipped");

    const completeEvent = events.find((event) => event.type === "complete");
    expect(completeEvent?.data).toMatchObject({
      total: 2,
      failed: 0,
      skipped: 0,
      replayed: true,
      repo_id: "repo-1",
    });

    expect(mockEncodeEpisode).not.toHaveBeenCalled();
    expect(mockFetchPRReviews).not.toHaveBeenCalled();
    expect(mockFetchPRDiff).not.toHaveBeenCalled();
  });

  it("does not replay when cache is mixed and keeps live import path", async () => {
    mockFetchMergedPRs.mockResolvedValue(BASE_PRS);
    mockListEpisodesForRepo.mockReturnValue([
      {
        id: "ep-101",
        source_pr_number: 101,
        title: "Cached 101",
        salience_score: 7,
        pattern_key: "review-hygiene",
        the_pattern: "cached-pattern",
        triggers: ["cache"],
      },
    ]);

    const response = await POST(
      new Request("http://localhost/api/github/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ owner: "acme", repo: "demo" }),
      }),
    );

    expect(response.status).toBe(200);
    const events = await parseImportEvents(response);
    const types = events.map((event) => event.type);

    expect(types).not.toContain("replay_manifest");
    expect(types).toContain("episode_created");
    expect(mockEncodeEpisode).toHaveBeenCalled();
  });

  it("does not replay when there are no merged PRs", async () => {
    mockFetchMergedPRs.mockResolvedValue([]);
    mockListEpisodesForRepo.mockReturnValue([]);

    const response = await POST(
      new Request("http://localhost/api/github/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ owner: "acme", repo: "demo" }),
      }),
    );

    expect(response.status).toBe(200);
    const events = await parseImportEvents(response);
    const types = events.map((event) => event.type);

    expect(types).toEqual(["pr_found", "complete"]);
    expect(types).not.toContain("replay_manifest");
    expect(mockEncodeEpisode).not.toHaveBeenCalled();
  });
});
