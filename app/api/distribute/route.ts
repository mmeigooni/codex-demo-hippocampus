import type { ConsolidationModelOutput, DistributionEvent } from "@/lib/codex/types";
import { renderPackToMarkdown } from "@/lib/distribution/render-pack";
import { createPackPR } from "@/lib/distribution/create-pack-pr";
import {
  completeConsolidationRun,
  findRepoByIdForUser,
  latestCompletedRunForRepo,
} from "@/lib/fallback/runtime-memory-store";
import { MISSING_PROVIDER_TOKEN_MESSAGE } from "@/lib/github/public-only-policy";
import { fetchRepo } from "@/lib/github/client";
import {
  isProfilesSchemaNotReadyError,
  resolveStorageModeAfterProfilesPreflight,
  SCHEMA_NOT_READY_PROFILES_CODE,
  type StorageMode,
} from "@/lib/supabase/schema-guard";
import { createServerClient } from "@/lib/supabase/server";

interface DistributeRequest {
  repo_id?: string;
}

interface ProfileUserContext {
  id: string;
  githubUsername: string | null;
  avatarUrl: string | null;
}

interface DistributionSummaryMetadata {
  status: "completed" | "failed";
  mode: StorageMode;
  distributed_at: string;
  skipped_pr: boolean;
  reason?: string;
  pr_url?: string;
  pr_number?: number;
  branch?: string;
  message?: string;
}

type Emit = (event: DistributionEvent) => void;

function buildSseMessage(event: DistributionEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function toSummaryRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
}

function withDistributionSummary(
  summary: unknown,
  distribution: DistributionSummaryMetadata,
): Record<string, unknown> {
  const base = toSummaryRecord(summary);
  return {
    ...base,
    distribution,
  };
}

function normalizePack(maybePack: unknown): ConsolidationModelOutput | null {
  if (!maybePack || typeof maybePack !== "object") {
    return null;
  }

  const value = maybePack as Partial<ConsolidationModelOutput>;

  return {
    patterns: Array.isArray(value.patterns) ? value.patterns : [],
    rules_to_promote: Array.isArray(value.rules_to_promote) ? value.rules_to_promote : [],
    contradictions: Array.isArray(value.contradictions) ? value.contradictions : [],
    salience_updates: Array.isArray(value.salience_updates) ? value.salience_updates : [],
    prune_candidates: Array.isArray(value.prune_candidates) ? value.prune_candidates : [],
  };
}

async function ensureProfileId(
  user: ProfileUserContext,
  supabase: Awaited<ReturnType<typeof createServerClient>>,
) {
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingProfile?.id) {
    return existingProfile.id;
  }

  const { data: createdProfile, error } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      github_username: user.githubUsername,
      avatar_url: user.avatarUrl,
    })
    .select("id")
    .single();

  if (error || !createdProfile?.id) {
    throw new Error(error?.message ?? "Failed to create profile");
  }

  return createdProfile.id;
}

async function runSupabaseDistribution({
  body,
  emit,
  supabase,
  userContext,
}: {
  body: DistributeRequest;
  emit: Emit;
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  userContext: ProfileUserContext;
}) {
  let runId: string | null = null;
  let runSummary: unknown = null;

  try {
    const profileId = await ensureProfileId(userContext, supabase);

    const { data: selectedRepo, error: repoError } = await supabase
      .from("repos")
      .select("id, owner, name, full_name")
      .eq("id", body.repo_id)
      .eq("connected_by_profile_id", profileId)
      .maybeSingle();

    if (repoError) {
      throw new Error(repoError.message);
    }

    if (!selectedRepo?.id) {
      throw new Error("No connected repository found for distribution");
    }

    const { data: latestRun, error: runError } = await supabase
      .from("consolidation_runs")
      .select("id, summary")
      .eq("repo_id", selectedRepo.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runError) {
      throw new Error(runError.message);
    }

    if (!latestRun?.id) {
      throw new Error("No completed consolidation run found. Run a sleep cycle first.");
    }

    runId = latestRun.id;
    runSummary = latestRun.summary;

    const pack = normalizePack((latestRun.summary as { pack?: unknown } | null)?.pack);
    if (!pack) {
      throw new Error("Latest consolidation run is missing a distribution pack");
    }

    emit({
      type: "distribution_start",
      data: {
        run_id: runId,
        repo_id: selectedRepo.id,
        repo_full_name: selectedRepo.full_name,
      },
    });

    const markdown = renderPackToMarkdown(pack, selectedRepo.full_name);

    emit({
      type: "pack_rendered",
      data: {
        run_id: runId,
        markdown_length: markdown.length,
      },
    });

    const sessionResult = await supabase.auth.getSession();
    const token = sessionResult.data.session?.provider_token;

    if (!token) {
      throw new Error(MISSING_PROVIDER_TOKEN_MESSAGE);
    }

    const remoteRepo = await fetchRepo(selectedRepo.owner, selectedRepo.name, token);

    const prResult = await createPackPR({
      token,
      owner: selectedRepo.owner,
      repo: selectedRepo.name,
      defaultBranch: remoteRepo.defaultBranch,
      markdownContent: markdown,
    });

    emit({
      type: "pr_created",
      data: {
        run_id: runId,
        pr_url: prResult.prUrl,
        pr_number: prResult.prNumber,
        branch: prResult.branch,
      },
    });

    const distribution = {
      status: "completed",
      mode: "supabase",
      distributed_at: new Date().toISOString(),
      skipped_pr: false,
      pr_url: prResult.prUrl,
      pr_number: prResult.prNumber,
      branch: prResult.branch,
    } satisfies DistributionSummaryMetadata;

    const nextSummary = withDistributionSummary(runSummary, distribution);

    const { error: persistError } = await supabase
      .from("consolidation_runs")
      .update({ summary: nextSummary })
      .eq("id", runId);

    if (persistError) {
      throw new Error(persistError.message);
    }

    emit({
      type: "distribution_complete",
      data: {
        skipped_pr: false,
        markdown,
        pr_url: prResult.prUrl,
        pr_number: prResult.prNumber,
        branch: prResult.branch,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected distribution error";

    if (runId) {
      const distribution = {
        status: "failed",
        mode: "supabase",
        distributed_at: new Date().toISOString(),
        skipped_pr: true,
        message,
      } satisfies DistributionSummaryMetadata;

      await supabase
        .from("consolidation_runs")
        .update({ summary: withDistributionSummary(runSummary, distribution) })
        .eq("id", runId);
    }

    emit({
      type: "distribution_error",
      data: {
        run_id: runId,
        message,
      },
    });
  }
}

async function runMemoryFallbackDistribution({
  body,
  emit,
  user,
}: {
  body: DistributeRequest;
  emit: Emit;
  user: { id: string };
}) {
  let runId: string | null = null;
  let runSummary: unknown = null;

  try {
    const selectedRepo = findRepoByIdForUser(user.id, body.repo_id ?? "");

    if (!selectedRepo?.id) {
      throw new Error("No connected repository found for distribution");
    }

    const latestRun = latestCompletedRunForRepo(selectedRepo.id);

    if (!latestRun?.id) {
      throw new Error("No completed consolidation run found. Run a sleep cycle first.");
    }

    runId = latestRun.id;
    runSummary = latestRun.summary;

    const pack = normalizePack((latestRun.summary as { pack?: unknown } | null)?.pack);
    if (!pack) {
      throw new Error("Latest consolidation run is missing a distribution pack");
    }

    emit({
      type: "distribution_start",
      data: {
        run_id: runId,
        repo_id: selectedRepo.id,
        repo_full_name: selectedRepo.full_name,
      },
    });

    const markdown = renderPackToMarkdown(pack, selectedRepo.full_name);

    emit({
      type: "pack_rendered",
      data: {
        run_id: runId,
        markdown_length: markdown.length,
      },
    });

    const distribution = {
      status: "completed",
      mode: "memory-fallback",
      distributed_at: new Date().toISOString(),
      skipped_pr: true,
      reason: "memory-fallback",
    } satisfies DistributionSummaryMetadata;

    completeConsolidationRun(runId, withDistributionSummary(runSummary, distribution));

    emit({
      type: "distribution_complete",
      data: {
        skipped_pr: true,
        reason: "memory-fallback",
        markdown,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected distribution error";

    if (runId) {
      const distribution = {
        status: "failed",
        mode: "memory-fallback",
        distributed_at: new Date().toISOString(),
        skipped_pr: true,
        message,
      } satisfies DistributionSummaryMetadata;

      completeConsolidationRun(runId, withDistributionSummary(runSummary, distribution));
    }

    emit({
      type: "distribution_error",
      data: {
        run_id: runId,
        message,
      },
    });
  }
}

export async function POST(request: Request) {
  let body: DistributeRequest | null = null;

  try {
    body = (await request.json()) as DistributeRequest;
  } catch {
    body = null;
  }

  if (!body?.repo_id) {
    return Response.json({ error: "repo_id is required" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const [userResult] = await Promise.all([supabase.auth.getUser()]);
  const user = userResult.data.user;

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userContext: ProfileUserContext = {
    id: user.id,
    githubUsername: user.user_metadata?.user_name ?? user.user_metadata?.preferred_username ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };

  let storageMode: StorageMode;

  try {
    storageMode = await resolveStorageModeAfterProfilesPreflight(supabase);
  } catch (error) {
    if (isProfilesSchemaNotReadyError(error)) {
      return Response.json(
        {
          error: error.message,
          code: SCHEMA_NOT_READY_PROFILES_CODE,
        },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : "Unexpected schema preflight error";
    return Response.json({ error: message }, { status: 500 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: DistributionEvent) => {
        controller.enqueue(encoder.encode(buildSseMessage(event)));
      };

      try {
        if (storageMode === "supabase") {
          await runSupabaseDistribution({
            body,
            emit,
            supabase,
            userContext,
          });
        } else {
          await runMemoryFallbackDistribution({
            body,
            emit,
            user: { id: user.id },
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-hippocampus-storage-mode": storageMode,
    },
  });
}
