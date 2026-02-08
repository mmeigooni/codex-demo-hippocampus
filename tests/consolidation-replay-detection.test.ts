import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseJsonSseBuffer } from "@/lib/sse/parse";

const mockCreateServerClient = vi.hoisted(() => vi.fn());
const mockResolveStorageModeAfterProfilesPreflight = vi.hoisted(() => vi.fn());
const mockConsolidateEpisodes = vi.hoisted(() => vi.fn());

const mockApplySalienceUpdates = vi.hoisted(() => vi.fn());
const mockCompleteConsolidationRun = vi.hoisted(() => vi.fn());
const mockCreateConsolidationRun = vi.hoisted(() => vi.fn());
const mockFailConsolidationRun = vi.hoisted(() => vi.fn());
const mockFindRepoByIdForUser = vi.hoisted(() => vi.fn());
const mockListEpisodesForRepo = vi.hoisted(() => vi.fn());
const mockListReposForUser = vi.hoisted(() => vi.fn());
const mockListRulesForRepo = vi.hoisted(() => vi.fn());
const mockLatestCompletedRunForRepo = vi.hoisted(() => vi.fn());
const mockUpsertRulesForRepo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock("@/lib/supabase/schema-guard", () => ({
  resolveStorageModeAfterProfilesPreflight: mockResolveStorageModeAfterProfilesPreflight,
  isProfilesSchemaNotReadyError: () => false,
  SCHEMA_NOT_READY_PROFILES_CODE: "SCHEMA_NOT_READY_PROFILES",
}));

vi.mock("@/lib/codex/consolidator", () => ({
  consolidateEpisodes: mockConsolidateEpisodes,
}));

vi.mock("@/lib/fallback/runtime-memory-store", () => ({
  applySalienceUpdates: mockApplySalienceUpdates,
  completeConsolidationRun: mockCompleteConsolidationRun,
  createConsolidationRun: mockCreateConsolidationRun,
  failConsolidationRun: mockFailConsolidationRun,
  findRepoByIdForUser: mockFindRepoByIdForUser,
  listEpisodesForRepo: mockListEpisodesForRepo,
  listReposForUser: mockListReposForUser,
  listRulesForRepo: mockListRulesForRepo,
  latestCompletedRunForRepo: mockLatestCompletedRunForRepo,
  upsertRulesForRepo: mockUpsertRulesForRepo,
}));

import { POST } from "@/app/api/consolidate/route";

const BASE_REPO = {
  id: "repo-1",
  full_name: "acme/demo",
};

const BASE_EPISODES = [
  {
    id: "ep-1",
    title: "Episode one",
    what_happened: "something happened",
    pattern_key: "review-hygiene",
    the_pattern: "pattern",
    the_fix: "fix",
    why_it_matters: "matters",
    salience_score: 7,
    triggers: ["tests"],
    source_pr_number: 100,
    source_url: "https://example.com/pr/100",
  },
];

const BASE_RULES = [
  {
    id: "rule-1",
    rule_key: "review-hygiene",
    title: "Rule one",
    description: "desc",
    triggers: ["tests"],
    source_episode_ids: ["ep-1"],
    confidence: 0.6,
  },
];

const REPLAY_PACK = {
  patterns: [{ name: "pattern", episode_ids: ["ep-1"], summary: "summary" }],
  rules_to_promote: [
    {
      rule_key: "review-hygiene",
      title: "Rule one",
      description: "desc",
      triggers: ["tests"],
      source_episode_ids: ["ep-1"],
      confidence: 0.9,
    },
  ],
  contradictions: [],
  salience_updates: [],
  prune_candidates: [],
};

function createSupabaseAuthMock() {
  return {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "user-1",
            user_metadata: { user_name: "acme-dev" },
          },
        },
      }),
    },
  };
}

async function parseEvents(response: Response) {
  const body = await response.text();
  const normalized = body.endsWith("\n\n") ? body : `${body}\n\n`;
  const parsed = parseJsonSseBuffer(normalized);
  return parsed.events as Array<{ type: string; data: Record<string, unknown> }>;
}

beforeEach(() => {
  vi.clearAllMocks();

  mockCreateServerClient.mockResolvedValue(createSupabaseAuthMock());
  mockResolveStorageModeAfterProfilesPreflight.mockResolvedValue("memory-fallback");
  mockListReposForUser.mockReturnValue([BASE_REPO]);
  mockFindRepoByIdForUser.mockImplementation((_userId: string, repoId: string) =>
    repoId === BASE_REPO.id ? BASE_REPO : null,
  );
  mockListEpisodesForRepo.mockReturnValue(BASE_EPISODES);
  mockListRulesForRepo.mockReturnValue(BASE_RULES);
  mockCreateConsolidationRun.mockReturnValue({ id: "run-live" });
  mockUpsertRulesForRepo.mockReturnValue(BASE_RULES);

  mockConsolidateEpisodes.mockResolvedValue({
    patterns: REPLAY_PACK.patterns,
    rules_to_promote: REPLAY_PACK.rules_to_promote,
    contradictions: REPLAY_PACK.contradictions,
    salience_updates: REPLAY_PACK.salience_updates,
    prune_candidates: REPLAY_PACK.prune_candidates,
    used_fallback: false,
  });
});

describe("POST /api/consolidate replay detection", () => {
  it("replays cached consolidation when a completed run has a valid pack", async () => {
    mockLatestCompletedRunForRepo.mockReturnValue({
      id: "run-replay",
      status: "completed",
      summary: {
        repo_id: "repo-1",
        pack: REPLAY_PACK,
        reasoning_text: "cached reasoning text",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/consolidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_id: BASE_REPO.id }),
      }),
    );

    expect(response.status).toBe(200);
    const events = await parseEvents(response);
    const types = events.map((event) => event.type);

    expect(types).toContain("replay_manifest");
    expect(types).toContain("consolidation_start");
    expect(types).toContain("reasoning_start");
    expect(types).toContain("reasoning_complete");
    expect(types).toContain("pattern_detected");
    expect(types).toContain("rule_promoted");
    expect(types).toContain("consolidation_complete");

    const promotedRuleEvent = events.find((event) => event.type === "rule_promoted");
    expect(promotedRuleEvent?.data.rule_id).toBe("rule-1");

    expect(mockConsolidateEpisodes).not.toHaveBeenCalled();
    expect(mockCreateConsolidationRun).not.toHaveBeenCalled();
  });

  it("falls back to live consolidation when replay pack is missing", async () => {
    mockLatestCompletedRunForRepo.mockReturnValue({
      id: "run-bad",
      status: "completed",
      summary: {},
    });

    const response = await POST(
      new Request("http://localhost/api/consolidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_id: BASE_REPO.id }),
      }),
    );

    expect(response.status).toBe(200);
    const events = await parseEvents(response);
    const types = events.map((event) => event.type);

    expect(types).not.toContain("replay_manifest");
    expect(types).toContain("consolidation_start");
    expect(types).toContain("consolidation_complete");
    const promotedRuleEvent = events.find((event) => event.type === "rule_promoted");
    expect(promotedRuleEvent?.data.rule_id).toBe("rule-1");
    expect(mockConsolidateEpisodes).toHaveBeenCalledTimes(1);
    expect(mockCreateConsolidationRun).toHaveBeenCalledTimes(1);
  });

  it("omits reasoning events when replay summary has no reasoning text", async () => {
    mockLatestCompletedRunForRepo.mockReturnValue({
      id: "run-replay",
      status: "completed",
      summary: {
        repo_id: "repo-1",
        pack: REPLAY_PACK,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/consolidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_id: BASE_REPO.id }),
      }),
    );

    expect(response.status).toBe(200);
    const events = await parseEvents(response);
    const types = events.map((event) => event.type);

    expect(types).toContain("replay_manifest");
    expect(types).not.toContain("reasoning_start");
    expect(types).not.toContain("reasoning_complete");
  });

  it("ignores failed/missing cached runs and uses live consolidation", async () => {
    mockLatestCompletedRunForRepo.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/consolidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_id: BASE_REPO.id }),
      }),
    );

    expect(response.status).toBe(200);
    const events = await parseEvents(response);
    const types = events.map((event) => event.type);

    expect(types).not.toContain("replay_manifest");
    expect(types).toContain("consolidation_complete");
    const promotedRuleEvent = events.find((event) => event.type === "rule_promoted");
    expect(promotedRuleEvent?.data.rule_id).toBe("rule-1");
    expect(mockConsolidateEpisodes).toHaveBeenCalledTimes(1);
  });
});
