import { consolidateEpisodes } from "@/lib/codex/consolidator";
import type {
  ConsolidationEpisodeInput,
  ConsolidationEvent,
  ConsolidationRuleCandidate,
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
  latestCompletedRunForRepo,
  upsertRulesForRepo,
} from "@/lib/fallback/runtime-memory-store";
import {
  isProfilesSchemaNotReadyError,
  resolveStorageModeAfterProfilesPreflight,
  SCHEMA_NOT_READY_PROFILES_CODE,
  type StorageMode,
} from "@/lib/supabase/schema-guard";
import { createServerClient } from "@/lib/supabase/server";
import { PATTERN_KEYS, type PatternKey } from "@/lib/memory/pattern-taxonomy";

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

function createThrottledReasoningEmit(emit: Emit, intervalMs = 200) {
  let buffered: { runId: string; text: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const emitBuffered = () => {
    if (!buffered) {
      return;
    }

    const payload = buffered;
    buffered = null;
    emit({
      type: "reasoning_delta",
      data: {
        run_id: payload.runId,
        text: payload.text,
      },
    });
  };

  const clearTimer = () => {
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    timer = null;
  };

  const scheduleFlush = () => {
    if (timer) {
      return;
    }

    timer = setTimeout(() => {
      timer = null;
      emitBuffered();
    }, intervalMs);
  };

  return {
    bufferDelta(runId: string, text: string) {
      buffered = { runId, text };
      scheduleFlush();
    },
    flush(runId?: string) {
      clearTimer();
      if (!buffered) {
        return;
      }

      if (runId && buffered.runId !== runId) {
        return;
      }

      emitBuffered();
    },
    dispose() {
      clearTimer();
      buffered = null;
    },
  };
}

function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function normalizePatternKey(value: unknown): PatternKey {
  if (typeof value === "string" && PATTERN_KEYS.includes(value as PatternKey)) {
    return value as PatternKey;
  }

  return "review-hygiene";
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReplaySummaryPack(value: unknown) {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.patterns) &&
    Array.isArray(value.rules_to_promote) &&
    Array.isArray(value.contradictions) &&
    Array.isArray(value.salience_updates) &&
    Array.isArray(value.prune_candidates)
  );
}

function extractReplaySummary(summary: unknown) {
  if (!isObjectRecord(summary)) {
    return null;
  }

  if (!isReplaySummaryPack(summary.pack)) {
    return null;
  }

  return {
    summary,
    pack: summary.pack as {
      patterns: Array<Record<string, unknown>>;
      rules_to_promote: Array<Record<string, unknown>>;
      contradictions: Array<Record<string, unknown>>;
      salience_updates: Array<Record<string, unknown>>;
    },
    reasoningText: typeof summary.reasoning_text === "string" ? summary.reasoning_text : "",
  };
}

function emitConsolidationReplay({
  emit,
  runId,
  repoId,
  repoFullName,
  episodeCount,
  existingRuleCount,
  replaySummary,
}: {
  emit: Emit;
  runId: string;
  repoId: string;
  repoFullName: string;
  episodeCount: number;
  existingRuleCount: number;
  replaySummary: ReturnType<typeof extractReplaySummary>;
}) {
  if (!replaySummary) {
    return false;
  }

  emit({
    type: "replay_manifest",
    data: {
      mode: "consolidation_replay",
      run_id: runId,
      has_reasoning: replaySummary.reasoningText.length > 0,
    },
  });

  emit({
    type: "consolidation_start",
    data: {
      run_id: runId,
      repo_id: repoId,
      repo_full_name: repoFullName,
      episode_count: episodeCount,
      existing_rule_count: existingRuleCount,
    },
  });

  if (replaySummary.reasoningText.length > 0) {
    emit({ type: "reasoning_start", data: { run_id: runId } });
    emit({
      type: "reasoning_complete",
      data: {
        run_id: runId,
        text: replaySummary.reasoningText,
      },
    });
  }

  for (const pattern of replaySummary.pack.patterns) {
    emit({ type: "pattern_detected", data: pattern });
  }

  for (const rule of replaySummary.pack.rules_to_promote) {
    emit({
      type: "rule_promoted",
      data: {
        ...rule,
        confidence: Number(rule.confidence ?? 0),
      },
    });
  }

  for (const contradiction of replaySummary.pack.contradictions) {
    emit({ type: "contradiction_found", data: contradiction });
  }

  for (const update of replaySummary.pack.salience_updates) {
    emit({ type: "salience_updated", data: update });
  }

  emit({
    type: "consolidation_complete",
    data: {
      run_id: runId,
      summary: replaySummary.summary,
    },
  });

  return true;
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
  let capturedReasoningText = "";
  const throttledReasoningEmit = createThrottledReasoningEmit(emit);

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

    const { data: existingRun, error: existingRunError } = await supabase
      .from("consolidation_runs")
      .select("id, summary")
      .eq("repo_id", selectedRepo.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRunError) {
      throw new Error(existingRunError.message);
    }

    const replaySummary = extractReplaySummary(existingRun?.summary);

    if (existingRun?.id && replaySummary) {
      const [episodeCountResponse, ruleCountResponse] = await Promise.all([
        supabase.from("episodes").select("id", { count: "exact", head: true }).eq("repo_id", selectedRepo.id),
        supabase.from("rules").select("id", { count: "exact", head: true }).eq("repo_id", selectedRepo.id),
      ]);

      if (episodeCountResponse.error) {
        throw new Error(episodeCountResponse.error.message);
      }

      if (ruleCountResponse.error) {
        throw new Error(ruleCountResponse.error.message);
      }

      const replayed = emitConsolidationReplay({
        emit,
        runId: existingRun.id,
        repoId: selectedRepo.id,
        repoFullName: selectedRepo.full_name,
        episodeCount: Number(episodeCountResponse.count ?? 0),
        existingRuleCount: Number(ruleCountResponse.count ?? 0),
        replaySummary,
      });

      if (replayed) {
        return;
      }
    }

    if (existingRun?.id && existingRun.summary) {
      console.warn("[consolidation] replay cache incomplete; falling back to live consolidation path");
    }

    const [episodesResponse, rulesResponse, runResponse] = await Promise.all([
      supabase
        .from("episodes")
        .select(
          "id,title,what_happened,pattern_key,the_pattern,the_fix,why_it_matters,salience_score,triggers,source_pr_number,source_url",
        )
        .eq("repo_id", selectedRepo.id)
        .order("created_at", { ascending: false })
        .limit(400),
      supabase
        .from("rules")
        .select("id,rule_key,title,description,triggers,source_episode_ids,confidence")
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
      pattern_key: normalizePatternKey(episode.pattern_key),
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
      rule_key: normalizePatternKey(rule.rule_key),
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

    const result = await consolidateEpisodes(
      {
        repoFullName: selectedRepo.full_name,
        episodes,
        existingRules,
        signal: request.signal,
      },
      {
        onReasoningStart: () => {
          emit({ type: "reasoning_start", data: { run_id: runId } });
        },
        onReasoningDelta: (text) => {
          if (!runId) {
            return;
          }
          throttledReasoningEmit.bufferDelta(runId, text);
        },
        onReasoningComplete: (text) => {
          if (!runId) {
            return;
          }
          capturedReasoningText = text;
          throttledReasoningEmit.flush(runId);
          emit({ type: "reasoning_complete", data: { run_id: runId, text } });
        },
        onResponseStart: () => {
          emit({ type: "response_start", data: { run_id: runId } });
        },
        onResponseDelta: (text) => {
          emit({
            type: "response_delta",
            data: { run_id: runId, partial_length: text.length },
          });
        },
      },
    );

    for (const pattern of result.patterns) {
      emit({ type: "pattern_detected", data: pattern });
    }

    const promotedRulesForSummary: Array<ConsolidationRuleCandidate & { confidence: number }> = [];
    const episodeMap = new Map(episodes.map((episode) => [episode.id, episode]));

    for (const rule of result.rules_to_promote) {
      const confidence = computeConfidence(rule.source_episode_ids, episodeMap);
      const payload = {
        rule_key: rule.rule_key,
        title: rule.title,
        description: rule.description,
        triggers: rule.triggers,
        source_episode_ids: rule.source_episode_ids,
        confidence,
      };
      promotedRulesForSummary.push(payload);

      const { error: upsertRuleError } = await supabase
        .from("rules")
        .upsert({ repo_id: selectedRepo.id, ...payload }, { onConflict: "repo_id,rule_key" });

      if (upsertRuleError) {
        throw new Error(upsertRuleError.message);
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
        rules_promoted: promotedRulesForSummary.length,
        contradictions: result.contradictions.length,
        salience_updates: result.salience_updates.length,
        prune_candidates: result.prune_candidates.length,
      },
      reasoning_text: capturedReasoningText,
      pack: {
        patterns: result.patterns,
        rules_to_promote: promotedRulesForSummary,
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
    throttledReasoningEmit.flush(runId ?? undefined);
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
  } finally {
    throttledReasoningEmit.dispose();
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
  let capturedReasoningText = "";
  const throttledReasoningEmit = createThrottledReasoningEmit(emit);

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
        pattern_key: normalizePatternKey(episode.pattern_key),
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
        rule_key: normalizePatternKey(rule.rule_key),
        title: rule.title,
        description: rule.description,
        triggers: normalizeTextArray(rule.triggers),
        source_episode_ids: normalizeTextArray(rule.source_episode_ids),
        confidence: Number(rule.confidence ?? 0),
      }));

    const existingRun = latestCompletedRunForRepo(selectedRepo.id);
    const replaySummary = extractReplaySummary(existingRun?.summary);

    if (existingRun?.id && replaySummary) {
      const replayed = emitConsolidationReplay({
        emit,
        runId: existingRun.id,
        repoId: selectedRepo.id,
        repoFullName: selectedRepo.full_name,
        episodeCount: episodes.length,
        existingRuleCount: existingRules.length,
        replaySummary,
      });

      if (replayed) {
        return;
      }
    }

    if (existingRun?.id && existingRun.summary) {
      console.warn("[consolidation] replay cache incomplete; falling back to live consolidation path");
    }

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

    const result = await consolidateEpisodes(
      {
        repoFullName: selectedRepo.full_name,
        episodes,
        existingRules,
        signal: request.signal,
      },
      {
        onReasoningStart: () => {
          emit({ type: "reasoning_start", data: { run_id: runId } });
        },
        onReasoningDelta: (text) => {
          if (!runId) {
            return;
          }
          throttledReasoningEmit.bufferDelta(runId, text);
        },
        onReasoningComplete: (text) => {
          if (!runId) {
            return;
          }
          capturedReasoningText = text;
          throttledReasoningEmit.flush(runId);
          emit({ type: "reasoning_complete", data: { run_id: runId, text } });
        },
        onResponseStart: () => {
          emit({ type: "response_start", data: { run_id: runId } });
        },
        onResponseDelta: (text) => {
          emit({
            type: "response_delta",
            data: { run_id: runId, partial_length: text.length },
          });
        },
      },
    );

    for (const pattern of result.patterns) {
      emit({ type: "pattern_detected", data: pattern });
    }

    const promotedRulesForSummary: Array<ConsolidationRuleCandidate & { confidence: number }> = [];
    const episodeMap = new Map(episodes.map((episode) => [episode.id, episode]));

    for (const rule of result.rules_to_promote) {
      const confidence = computeConfidence(rule.source_episode_ids, episodeMap);
      const promotedRule = {
        rule_key: rule.rule_key,
        title: rule.title,
        description: rule.description,
        triggers: rule.triggers,
        source_episode_ids: rule.source_episode_ids,
        confidence,
      };
      promotedRulesForSummary.push(promotedRule);

      upsertRulesForRepo(selectedRepo.id, [
        promotedRule,
      ]);

      emit({
        type: "rule_promoted",
        data: promotedRule,
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
        rules_promoted: promotedRulesForSummary.length,
        contradictions: result.contradictions.length,
        salience_updates: result.salience_updates.length,
        prune_candidates: result.prune_candidates.length,
      },
      reasoning_text: capturedReasoningText,
      pack: {
        patterns: result.patterns,
        rules_to_promote: promotedRulesForSummary,
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
    throttledReasoningEmit.flush(runId ?? undefined);
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
  } finally {
    throttledReasoningEmit.dispose();
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
