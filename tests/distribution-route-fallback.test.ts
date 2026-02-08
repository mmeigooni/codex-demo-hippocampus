import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseJsonSseBuffer } from "@/lib/sse/parse";

const mockCreateServerClient = vi.hoisted(() => vi.fn());
const mockResolveStorageModeAfterProfilesPreflight = vi.hoisted(() => vi.fn());
const mockFetchRepo = vi.hoisted(() => vi.fn());
const mockCreatePackPR = vi.hoisted(() => vi.fn());
const mockRenderPackToMarkdown = vi.hoisted(() => vi.fn());

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
}));

vi.mock("@/lib/distribution/create-pack-pr", () => ({
  createPackPR: mockCreatePackPR,
}));

vi.mock("@/lib/distribution/render-pack", () => ({
  renderPackToMarkdown: mockRenderPackToMarkdown,
}));

import { POST } from "@/app/api/distribute/route";

const EMPTY_PACK = {
  patterns: [],
  rules_to_promote: [],
  contradictions: [],
  salience_updates: [],
  prune_candidates: [],
};

interface SupabaseMockOptions {
  latestRunSummary: Record<string, unknown> | null;
  providerToken?: string | null;
}

function createSupabaseMock(options: SupabaseMockOptions) {
  const updates: Array<Record<string, unknown>> = [];

  const profileSelectBuilder = {
    eq: () => profileSelectBuilder,
    maybeSingle: async () => ({
      data: { id: "profile-1" },
      error: null,
    }),
  };

  const repoSelectBuilder = {
    eq: () => repoSelectBuilder,
    maybeSingle: async () => ({
      data: {
        id: "repo-1",
        owner: "mmeigooni",
        name: "shopflow-platform",
        full_name: "mmeigooni/shopflow-platform",
      },
      error: null,
    }),
  };

  const runSelectBuilder = {
    eq: () => runSelectBuilder,
    order: () => runSelectBuilder,
    limit: () => runSelectBuilder,
    maybeSingle: async () => ({
      data:
        options.latestRunSummary === null
          ? null
          : {
              id: "run-1",
              summary: options.latestRunSummary,
            },
      error: null,
    }),
  };

  const client = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "user-1",
            user_metadata: { user_name: "mmeigooni" },
          },
        },
      }),
      getSession: async () => ({
        data: {
          session:
            options.providerToken === null
              ? null
              : {
                  provider_token: options.providerToken ?? "gho_mock_token",
                },
        },
      }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => profileSelectBuilder,
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "profile-1" },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "repos") {
        return {
          select: () => repoSelectBuilder,
        };
      }

      if (table === "consolidation_runs") {
        return {
          select: () => runSelectBuilder,
          update: (payload: Record<string, unknown>) => {
            updates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      throw new Error(`Unexpected table query in test: ${table}`);
    },
  };

  return { client, updates };
}

async function parseDistributionEvents(response: Response) {
  const body = await response.text();
  const normalized = body.endsWith("\n\n") ? body : `${body}\n\n`;
  const parsed = parseJsonSseBuffer(normalized);
  return parsed.events as Array<{ type: string; data: Record<string, unknown> }>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveStorageModeAfterProfilesPreflight.mockResolvedValue("supabase");
  mockRenderPackToMarkdown.mockReturnValue("# Team Memory");
});

describe("POST /api/distribute fallback behavior", () => {
  it("emits branch/file/pr-creating progress events before pr_created", async () => {
    const { client } = createSupabaseMock({
      latestRunSummary: { pack: EMPTY_PACK },
    });

    mockCreateServerClient.mockResolvedValue(client);
    mockFetchRepo.mockResolvedValue({ defaultBranch: "main" });
    mockCreatePackPR.mockImplementationOnce(async (_input: unknown, progress?: {
      onBranchCreated?: (branch: string) => void;
      onFileCommitted?: (sha: string) => void;
      onPRCreating?: () => void;
    }) => {
      progress?.onBranchCreated?.("hippocampus/team-memory-123");
      progress?.onFileCommitted?.("abc123");
      progress?.onPRCreating?.();
      return {
        prNumber: 42,
        prUrl: "https://github.com/mmeigooni/shopflow-platform/pull/42",
        branch: "hippocampus/team-memory-123",
        sha: "abc123",
      };
    });

    const response = await POST(
      new Request("http://localhost/api/distribute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_id: "repo-1" }),
      }),
    );

    expect(response.status).toBe(200);
    const events = await parseDistributionEvents(response);
    const types = events.map((event) => event.type);

    expect(types).toContain("distribution_start");
    expect(types).toContain("pack_rendered");
    expect(types).toContain("branch_created");
    expect(types).toContain("file_committed");
    expect(types).toContain("pr_creating");
    expect(types).toContain("pr_created");
    expect(types).toContain("distribution_complete");
    expect(types).not.toContain("distribution_error");

    expect(types.indexOf("branch_created")).toBeGreaterThan(types.indexOf("pack_rendered"));
    expect(types.indexOf("file_committed")).toBeGreaterThan(types.indexOf("branch_created"));
    expect(types.indexOf("pr_creating")).toBeGreaterThan(types.indexOf("file_committed"));
    expect(types.indexOf("pr_created")).toBeGreaterThan(types.indexOf("pr_creating"));
  });

  it("returns distribution_complete with markdown when PR creation fails", async () => {
    const { client, updates } = createSupabaseMock({
      latestRunSummary: { pack: EMPTY_PACK },
    });

    mockCreateServerClient.mockResolvedValue(client);
    mockFetchRepo.mockResolvedValue({ defaultBranch: "main" });
    mockCreatePackPR.mockRejectedValue(new Error("GitHub API request failed (status 404): Not Found"));

    const response = await POST(
      new Request("http://localhost/api/distribute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_id: "repo-1" }),
      }),
    );

    expect(response.status).toBe(200);
    const events = await parseDistributionEvents(response);
    const types = events.map((event) => event.type);

    expect(types).toContain("distribution_start");
    expect(types).toContain("pack_rendered");
    expect(types).toContain("distribution_complete");
    expect(types).not.toContain("distribution_error");

    const completeEvent = events.find((event) => event.type === "distribution_complete");
    expect(completeEvent?.data).toMatchObject({
      skipped_pr: true,
      markdown: "# Team Memory",
    });
    expect(String(completeEvent?.data.reason ?? "")).toContain("status 404");

    const summaryPayload = updates[0]?.summary as Record<string, unknown>;
    const distribution = summaryPayload.distribution as Record<string, unknown>;

    expect(distribution.status).toBe("completed");
    expect(distribution.mode).toBe("supabase");
    expect(distribution.skipped_pr).toBe(true);
    expect(String(distribution.reason ?? "")).toContain("status 404");
  });

  it("returns distribution_error when latest run has no pack", async () => {
    const { client, updates } = createSupabaseMock({
      latestRunSummary: {},
    });

    mockCreateServerClient.mockResolvedValue(client);

    const response = await POST(
      new Request("http://localhost/api/distribute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_id: "repo-1" }),
      }),
    );

    expect(response.status).toBe(200);
    const events = await parseDistributionEvents(response);
    const types = events.map((event) => event.type);

    expect(types).toContain("distribution_error");
    expect(types).not.toContain("distribution_complete");
    expect(mockCreatePackPR).not.toHaveBeenCalled();

    const errorEvent = events.find((event) => event.type === "distribution_error");
    expect(String(errorEvent?.data.message ?? "")).toContain("missing a distribution pack");

    const summaryPayload = updates[0]?.summary as Record<string, unknown>;
    const distribution = summaryPayload.distribution as Record<string, unknown>;
    expect(distribution.status).toBe("failed");
  });
});
