import { consolidateEpisodes } from "@/lib/codex/consolidator";
import type {
  ConsolidationEpisodeInput,
  ConsolidationEvent,
  ConsolidationRuleInput,
} from "@/lib/codex/types";
import {
  applySalienceUpdates,
  completeConsolidationRun,
  createConsolidationRun,
  failConsolidationRun,
  findRepoByIdForUser,
  listEpisodesForRepo,
  listReposForUser,
  listRulesForRepo,
  upsertRulesForRepo,
} from "@/lib/fallback/runtime-memory-store";
import {
  isProfilesSchemaNotReadyError,
  resolveStorageModeAfterProfilesPreflight,
  SCHEMA_NOT_READY_PROFILES_CODE,
  type StorageMode,
} from "@/lib/supabase/schema-guard";
import { createServerClient } from "@/lib/supabase/server";

interface ConsolidateRequest {
  repo_id?: string;
}

interface ProfileUserContext {
  id: string;
  githubUsername: string | null;
  avatarUrl: string | null;
}

function buildSseMessage(event: ConsolidationEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function computeConfidence(
  sourceEpisodeIds: string[],
  episodeMap: Map<string, ConsolidationEpisodeInput>,
) {
  if (sourceEpisodeIds.length === 0) {
    return 0;
  }

  const total = sourceEpisodeIds.reduce((sum, episodeId) => {
    return sum + (episodeMap.get(episodeId)?.salience_score ?? 0);
  }, 0);

  return Number((total / (sourceEpisodeIds.length * 10)).toFixed(2));
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

type Emit = (event: ConsolidationEvent) => void;

async function runSupabaseConsolidation({
  body,
  emit,
  request,
  supabase,
  userContext,
}: {
  body: ConsolidateRequest | null;
  emit: Emit;
  request: Request;
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  userContext: ProfileUserContext;
}) {
  let runId: string | null = null;

  try {
    const profileId = await ensureProfileId(userContext, supabase);

    const repoQuery = supabase
      .from("repos")
      .select("id, full_name")
      .eq("connected_by_profile_id", profileId)
      .order("updated_at", { ascending: false })
      .limit(1);

    const { data: selectedRepo, error: repoError } = body?.repo_id
      ? await supabase
          .from("repos")
          .select("id, full_name")
          .eq("id", body.repo_id)
          .eq("connected_by_profile_id", profileId)
          .maybeSingle()
      : await repoQuery.maybeSingle();

    if (repoError) {
      throw new Error(repoError.message);
    }

    if (!selectedRepo?.id) {
      throw new Error("No connected repository found for consolidation");
    }

    const [episodesResponse, rulesResponse, runResponse] = await Promise.all([
      supabase
        .from("episodes")
        .select(
          "id,title,what_happened,the_pattern,the_fix,why_it_matters,salience_score,triggers,source_pr_number,source_url",
        )
        .eq("repo_id", selectedRepo.id)
        .order("created_at", { ascending: false })
        .limit(400),
      supabase
        .from("rules")
        .select("id,title,description,triggers,source_episode_ids,confidence")
        .eq("repo_id", selectedRepo.id)
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from("consolidation_runs")
        .insert({ repo_id: selectedRepo.id, status: "running", summary: {} })
        .select("id")
        .single(),
    ]);

    if (episodesResponse.error) {
      throw new Error(episodesResponse.error.message);
    }

    if (rulesResponse.error) {
      throw new Error(rulesResponse.error.message);
    }

    if (runResponse.error || !runResponse.data?.id) {
      throw new Error(runResponse.error?.message ?? "Failed to create consolidation run");
    }

    runId = runResponse.data.id;

    const episodes: ConsolidationEpisodeInput[] = (episodesResponse.data ?? []).map((episode) => ({
      id: episode.id,
      title: episode.title,
      what_happened: episode.what_happened,
      the_pattern: episode.the_pattern,
      the_fix: episode.the_fix,
      why_it_matters: episode.why_it_matters,
      salience_score: Number(episode.salience_score ?? 0),
      triggers: normalizeTextArray(episode.triggers),
      source_pr_number: episode.source_pr_number,
      source_url: episode.source_url,
    }));

    const existingRules: ConsolidationRuleInput[] = (rulesResponse.data ?? []).map((rule) => ({
      id: rule.id,
      title: rule.title,
      description: rule.description,
      triggers: normalizeTextArray(rule.triggers),
      source_episode_ids: normalizeTextArray(rule.source_episode_ids),
      confidence: Number(rule.confidence ?? 0),
    }));

    emit({
      type: "consolidation_start",
      data: {
        run_id: runId,
        repo_id: selectedRepo.id,
        repo_full_name: selectedRepo.full_name,
        episode_count: episodes.length,
        existing_rule_count: existingRules.length,
      },
    });

    if (episodes.length === 0) {
      throw new Error("No episodes found for selected repository");
    }

    const result = await consolidateEpisodes({
      repoFullName: selectedRepo.full_name,
      episodes,
      existingRules,
      signal: request.signal,
    });

    for (const pattern of result.patterns) {
      emit({ type: "pattern_detected", data: pattern });
    }

    const existingRulesByTitle = new Map(existingRules.map((rule) => [rule.title.toLowerCase(), rule]));
    const episodeMap = new Map(episodes.map((episode) => [episode.id, episode]));

    for (const rule of result.rules_to_promote) {
      const confidence = computeConfidence(rule.source_episode_ids, episodeMap);
      const payload = {
        title: rule.title,
        description: rule.description,
        triggers: rule.triggers,
        source_episode_ids: rule.source_episode_ids,
        confidence,
      };

      const existing = existingRulesByTitle.get(rule.title.toLowerCase());

      if (existing) {
        const { error: updateError } = await supabase
          .from("rules")
          .update(payload)
          .eq("id", existing.id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      } else {
        const { error: insertRuleError } = await supabase
          .from("rules")
          .insert({ repo_id: selectedRepo.id, ...payload });

        if (insertRuleError) {
          throw new Error(insertRuleError.message);
        }
      }

      emit({
        type: "rule_promoted",
        data: {
          ...rule,
          confidence,
        },
      });
    }

    for (const contradiction of result.contradictions) {
      emit({ type: "contradiction_found", data: contradiction });
    }

    for (const update of result.salience_updates) {
      const { error: updateError } = await supabase
        .from("episodes")
        .update({ salience_score: update.salience_score })
        .eq("id", update.episode_id)
        .eq("repo_id", selectedRepo.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      emit({ type: "salience_updated", data: update });
    }

    const summary = {
      repo_id: selectedRepo.id,
      repo_full_name: selectedRepo.full_name,
      used_fallback: result.used_fallback,
      counts: {
        patterns: result.patterns.length,
        rules_promoted: result.rules_to_promote.length,
        contradictions: result.contradictions.length,
        salience_updates: result.salience_updates.length,
        prune_candidates: result.prune_candidates.length,
      },
      pack: {
        patterns: result.patterns,
        rules_to_promote: result.rules_to_promote,
        contradictions: result.contradictions,
        salience_updates: result.salience_updates,
        prune_candidates: result.prune_candidates,
      },
    };

    const { error: finalizeError } = await supabase
      .from("consolidation_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary,
      })
      .eq("id", runId);

    if (finalizeError) {
      throw new Error(finalizeError.message);
    }

    emit({
      type: "consolidation_complete",
      data: {
        run_id: runId,
        summary,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected consolidation error";

    if (runId) {
      await supabase
        .from("consolidation_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          summary: { error: message },
        })
        .eq("id", runId);
    }

    emit({
      type: "consolidation_error",
      data: {
        run_id: runId,
        message,
      },
    });
  }
}

async function runMemoryFallbackConsolidation({
  body,
  emit,
  request,
  user,
}: {
  body: ConsolidateRequest | null;
  emit: Emit;
  request: Request;
  user: { id: string };
}) {
  let runId: string | null = null;

  try {
    const selectedRepo = body?.repo_id
      ? findRepoByIdForUser(user.id, body.repo_id)
      : listReposForUser(user.id)[0] ?? null;

    if (!selectedRepo?.id) {
      throw new Error("No connected repository found for consolidation");
    }

    const episodes = listEpisodesForRepo(selectedRepo.id)
      .slice(0, 400)
      .map((episode) => ({
        id: episode.id,
        title: episode.title,
        what_happened: episode.what_happened,
        the_pattern: episode.the_pattern,
        the_fix: episode.the_fix,
        why_it_matters: episode.why_it_matters,
        salience_score: Number(episode.salience_score ?? 0),
        triggers: normalizeTextArray(episode.triggers),
        source_pr_number: episode.source_pr_number,
        source_url: episode.source_url,
      }));

    const existingRules: ConsolidationRuleInput[] = listRulesForRepo(selectedRepo.id)
      .slice(0, 200)
      .map((rule) => ({
        id: rule.id,
        title: rule.title,
        description: rule.description,
        triggers: normalizeTextArray(rule.triggers),
        source_episode_ids: normalizeTextArray(rule.source_episode_ids),
        confidence: Number(rule.confidence ?? 0),
      }));

    runId = createConsolidationRun(selectedRepo.id).id;

    emit({
      type: "consolidation_start",
      data: {
        run_id: runId,
        repo_id: selectedRepo.id,
        repo_full_name: selectedRepo.full_name,
        episode_count: episodes.length,
        existing_rule_count: existingRules.length,
      },
    });

    if (episodes.length === 0) {
      throw new Error("No episodes found for selected repository");
    }

    const result = await consolidateEpisodes({
      repoFullName: selectedRepo.full_name,
      episodes,
      existingRules,
      signal: request.signal,
    });

    for (const pattern of result.patterns) {
      emit({ type: "pattern_detected", data: pattern });
    }

    const episodeMap = new Map(episodes.map((episode) => [episode.id, episode]));

    for (const rule of result.rules_to_promote) {
      const confidence = computeConfidence(rule.source_episode_ids, episodeMap);
      upsertRulesForRepo(selectedRepo.id, [
        {
          title: rule.title,
          description: rule.description,
          triggers: rule.triggers,
          source_episode_ids: rule.source_episode_ids,
          confidence,
        },
      ]);

      emit({
        type: "rule_promoted",
        data: {
          ...rule,
          confidence,
        },
      });
    }

    for (const contradiction of result.contradictions) {
      emit({ type: "contradiction_found", data: contradiction });
    }

    applySalienceUpdates(
      selectedRepo.id,
      result.salience_updates.map((update) => ({
        episode_id: update.episode_id,
        salience_score: update.salience_score,
      })),
    );

    for (const update of result.salience_updates) {
      emit({ type: "salience_updated", data: update });
    }

    const summary = {
      repo_id: selectedRepo.id,
      repo_full_name: selectedRepo.full_name,
      used_fallback: result.used_fallback,
      counts: {
        patterns: result.patterns.length,
        rules_promoted: result.rules_to_promote.length,
        contradictions: result.contradictions.length,
        salience_updates: result.salience_updates.length,
        prune_candidates: result.prune_candidates.length,
      },
      pack: {
        patterns: result.patterns,
        rules_to_promote: result.rules_to_promote,
        contradictions: result.contradictions,
        salience_updates: result.salience_updates,
        prune_candidates: result.prune_candidates,
      },
    };

    completeConsolidationRun(runId, summary);

    emit({
      type: "consolidation_complete",
      data: {
        run_id: runId,
        summary,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected consolidation error";
    if (runId) {
      failConsolidationRun(runId, message);
    }

    emit({
      type: "consolidation_error",
      data: {
        run_id: runId,
        message,
      },
    });
  }
}

export async function POST(request: Request) {
  let body: ConsolidateRequest | null = null;

  try {
    body = (await request.json()) as ConsolidateRequest;
  } catch {
    body = null;
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
      const emit = (event: ConsolidationEvent) => {
        controller.enqueue(encoder.encode(buildSseMessage(event)));
      };

      try {
        if (storageMode === "supabase") {
          await runSupabaseConsolidation({
            body,
            emit,
            request,
            supabase,
            userContext,
          });
        } else {
          await runMemoryFallbackConsolidation({
            body,
            emit,
            request,
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
