import { fetchRepo, fetchMergedPRs, fetchPRDiff, fetchPRReviews } from "@/lib/github/client";
import { encodeEpisode } from "@/lib/codex/encoder";
import { executeSearch, generateSearchRules, summarizeTokenReduction } from "@/lib/codex/search";
import {
  applySalienceUpdates,
  insertEpisodeForRepo,
  listEpisodesForRepo,
  upsertRepoForUser,
} from "@/lib/fallback/runtime-memory-store";
import { collectExistingPrNumbers, isUniqueViolationError } from "@/lib/github/import-idempotency";
import type { ImportCompleteData, ImportEpisodeSummary, ImportEvent, ImportRepoRequest } from "@/lib/github/types";
import {
  isPrivateRepo,
  MISSING_PROVIDER_TOKEN_MESSAGE,
  PRIVATE_REPOS_NOT_SUPPORTED_MESSAGE,
} from "@/lib/github/public-only-policy";
import {
  DEMO_SALIENCE_TARGETS_BY_PR,
  isConfiguredDemoRepo,
} from "@/lib/codex/salience-policy";
import {
  isProfilesSchemaNotReadyError,
  resolveStorageModeAfterProfilesPreflight,
  SCHEMA_NOT_READY_PROFILES_CODE,
  type StorageMode,
} from "@/lib/supabase/schema-guard";
import { createServerClient } from "@/lib/supabase/server";
import { buildSseMessage } from "@/lib/sse/build-message";
import { normalizeTextArray } from "@/lib/server/normalize";
import { ensureProfileId, type ProfileUserContext } from "@/lib/supabase/profile";

async function ensureSupabaseRepoId(
  user: ProfileUserContext,
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  owner: string,
  repo: string,
) {
  const profileId = await ensureProfileId(user, supabase);
  const fullName = `${owner}/${repo}`;
  const { data: repoRecord, error: repoError } = await supabase
    .from("repos")
    .upsert(
      {
        owner,
        name: repo,
        full_name: fullName,
        source: "github",
        connected_by_profile_id: profileId,
      },
      { onConflict: "full_name" },
    )
    .select("id")
    .single();

  if (repoError || !repoRecord?.id) {
    throw new Error(repoError?.message ?? "Failed to create repository record");
  }

  return repoRecord.id;
}

async function listExistingEpisodePrNumbers(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  repoId: string,
) {
  const { data, error } = await supabase
    .from("episodes")
    .select("source_pr_number")
    .eq("repo_id", repoId)
    .not("source_pr_number", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  return collectExistingPrNumbers(data as Array<{ source_pr_number: number | null }> | null);
}

async function listSupabaseEpisodeSummariesForPrNumbers(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  repoId: string,
  prNumbers: number[],
) {
  const { data, error } = await supabase
    .from("episodes")
    .select("id,title,source_pr_number,salience_score,pattern_key,the_pattern,what_happened,the_fix,why_it_matters,triggers")
    .eq("repo_id", repoId)
    .in("source_pr_number", prNumbers)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const byPrNumber = new Map<number, ImportEpisodeSummary>();

  for (const row of data ?? []) {
    if (typeof row.source_pr_number !== "number") {
      continue;
    }

    if (byPrNumber.has(row.source_pr_number)) {
      continue;
    }

    byPrNumber.set(row.source_pr_number, {
      id: String(row.id),
      title: String(row.title ?? ""),
      source_pr_number: row.source_pr_number,
      salience_score: Number(row.salience_score ?? 0),
      pattern_key: String(row.pattern_key ?? ""),
      the_pattern: String(row.the_pattern ?? ""),
      what_happened: typeof row.what_happened === "string" ? row.what_happened : undefined,
      the_fix: typeof row.the_fix === "string" ? row.the_fix : undefined,
      why_it_matters: typeof row.why_it_matters === "string" ? row.why_it_matters : undefined,
      triggers: normalizeTextArray(row.triggers),
    } as ImportEpisodeSummary);
  }

  return byPrNumber;
}

function listRuntimeEpisodeSummariesByPrNumber(repoId: string) {
  const byPrNumber = new Map<number, ImportEpisodeSummary>();

  for (const episode of listEpisodesForRepo(repoId)) {
    if (typeof episode.source_pr_number !== "number") {
      continue;
    }

    if (byPrNumber.has(episode.source_pr_number)) {
      continue;
    }

    byPrNumber.set(episode.source_pr_number, {
      id: episode.id,
      title: episode.title,
      source_pr_number: episode.source_pr_number,
      salience_score: Number(episode.salience_score ?? 0),
      pattern_key: episode.pattern_key,
      the_pattern: episode.the_pattern,
      what_happened: episode.what_happened,
      the_fix: episode.the_fix,
      why_it_matters: episode.why_it_matters,
      triggers: normalizeTextArray(episode.triggers),
    });
  }

  return byPrNumber;
}

function isReplayReadyEpisodeSummary(value: ImportEpisodeSummary | null): value is ImportEpisodeSummary {
  if (!value) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    typeof value.source_pr_number === "number" &&
    Number.isFinite(value.salience_score) &&
    typeof value.the_pattern === "string" &&
    Array.isArray(value.triggers)
  );
}

interface EpisodeSalienceBackfill {
  episode_id: string;
  source_pr_number: number;
  salience_score: number;
}

function collectDemoSalienceBackfillUpdates(episodesByPrNumber: Map<number, ImportEpisodeSummary>) {
  const updates: EpisodeSalienceBackfill[] = [];

  for (const [prNumber, episode] of episodesByPrNumber.entries()) {
    const targetScore = DEMO_SALIENCE_TARGETS_BY_PR[prNumber];
    if (typeof targetScore !== "number") {
      continue;
    }

    if (Math.round(episode.salience_score) === targetScore) {
      continue;
    }

    updates.push({
      episode_id: episode.id,
      source_pr_number: prNumber,
      salience_score: targetScore,
    });
  }

  return updates;
}

async function applySupabaseDemoSalienceBackfill(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  repoId: string,
  requestedPrNumbers: number[],
) {
  const cachedEpisodeMap = await listSupabaseEpisodeSummariesForPrNumbers(supabase, repoId, requestedPrNumbers);
  const updates = collectDemoSalienceBackfillUpdates(cachedEpisodeMap);

  for (const update of updates) {
    const { error } = await supabase
      .from("episodes")
      .update({ salience_score: update.salience_score })
      .eq("id", update.episode_id);

    if (error) {
      throw new Error(error.message);
    }
  }

  return updates.length;
}

function applyRuntimeDemoSalienceBackfill(repoId: string) {
  const cachedEpisodeMap = listRuntimeEpisodeSummariesByPrNumber(repoId);
  const updates = collectDemoSalienceBackfillUpdates(cachedEpisodeMap);

  if (updates.length > 0) {
    applySalienceUpdates(
      repoId,
      updates.map((update) => ({
        episode_id: update.episode_id,
        salience_score: update.salience_score,
      })),
    );
  }

  return updates.length;
}

function buildImportCompleteData({
  total,
  failed,
  skipped,
  repoId,
  replayed,
  salienceBackfilled,
}: {
  total: number;
  failed: number;
  skipped: number;
  repoId?: string;
  replayed?: boolean;
  salienceBackfilled: number;
}): ImportCompleteData {
  const payload: ImportCompleteData = {
    total,
    failed,
    skipped,
  };

  if (repoId) {
    payload.repo_id = repoId;
  }

  if (replayed) {
    payload.replayed = true;
  }

  if (salienceBackfilled > 0) {
    payload.salience_backfilled = salienceBackfilled;
  }

  return payload;
}

function skippedEvent(pr: { number: number; title: string }): ImportEvent {
  return {
    type: "episode_skipped",
    data: {
      pr_number: pr.number,
      title: pr.title,
      reason: "already_imported",
    },
  };
}

export async function POST(request: Request) {
  let body: Partial<ImportRepoRequest>;

  try {
    body = (await request.json()) as Partial<ImportRepoRequest>;
  } catch {
    return Response.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const owner = body.owner?.trim();
  const repo = body.repo?.trim();

  if (!owner || !repo) {
    return Response.json({ error: "owner and repo are required" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const [userResult, sessionResult] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

  const user = userResult.data.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providerToken = sessionResult.data.session?.provider_token ?? null;
  const canUseAnonymousGithub = process.env.NODE_ENV !== "production";

  if (!providerToken && !canUseAnonymousGithub) {
    return Response.json(
      {
        error: MISSING_PROVIDER_TOKEN_MESSAGE,
      },
      { status: 400 },
    );
  }

  if (!providerToken && canUseAnonymousGithub) {
    console.warn("[import] provider_token missing; using anonymous GitHub API access in local/dev mode");
  }

  const userContext: ProfileUserContext = {
    id: user.id,
    githubUsername: user.user_metadata?.user_name ?? user.user_metadata?.preferred_username ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };

  try {
    const targetRepo = await fetchRepo(owner, repo, providerToken ?? undefined);
    if (isPrivateRepo(targetRepo)) {
      return Response.json(
        {
          error: PRIVATE_REPOS_NOT_SUPPORTED_MESSAGE,
        },
        { status: 403 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify repository visibility";
    return Response.json({ error: message }, { status: 400 });
  }

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
      const emit = (event: ImportEvent<unknown>) => {
        controller.enqueue(encoder.encode(buildSseMessage(event)));
      };

      try {
        const repoRecordId =
          storageMode === "supabase"
            ? await ensureSupabaseRepoId(userContext, supabase, owner, repo)
            : upsertRepoForUser({
                userId: user.id,
                owner,
                name: repo,
                fullName: `${owner}/${repo}`,
              }).id;

        const pullRequests = await fetchMergedPRs(owner, repo, 20, providerToken ?? undefined);
        emit({ type: "pr_found", data: { count: pullRequests.length } });

        let created = 0;
        let failed = 0;
        let skipped = 0;
        let salienceBackfilled = 0;
        const runtimeEpisodes = storageMode === "memory-fallback" ? listEpisodesForRepo(repoRecordId) : [];
        const existingPrNumbers =
          storageMode === "supabase"
            ? await listExistingEpisodePrNumbers(supabase, repoRecordId)
            : collectExistingPrNumbers(
                runtimeEpisodes.map((episode) => ({
                  source_pr_number: episode.source_pr_number,
                })),
              );
        const requestedPrNumbers = pullRequests.map((pullRequest) => pullRequest.number);
        const repoFullName = `${owner}/${repo}`;

        if (requestedPrNumbers.length > 0 && isConfiguredDemoRepo(repoFullName)) {
          salienceBackfilled =
            storageMode === "supabase"
              ? await applySupabaseDemoSalienceBackfill(supabase, repoRecordId, requestedPrNumbers)
              : applyRuntimeDemoSalienceBackfill(repoRecordId);
        }

        const allCached =
          pullRequests.length > 0 && pullRequests.every((pullRequest) => existingPrNumbers.has(pullRequest.number));

        if (allCached) {
          const cachedEpisodeMap =
            storageMode === "supabase"
              ? await listSupabaseEpisodeSummariesForPrNumbers(supabase, repoRecordId, requestedPrNumbers)
              : listRuntimeEpisodeSummariesByPrNumber(repoRecordId);
          const orderedCachedEpisodes = pullRequests.map((pullRequest) => cachedEpisodeMap.get(pullRequest.number) ?? null);

          if (orderedCachedEpisodes.every((episode) => isReplayReadyEpisodeSummary(episode))) {
            emit({
              type: "replay_manifest",
              data: {
                mode: "import_replay",
                total_episodes: orderedCachedEpisodes.length,
                repo_id: repoRecordId,
              },
            });

            for (let index = 0; index < pullRequests.length; index += 1) {
              const pullRequest = pullRequests[index]!;
              const cachedEpisode = orderedCachedEpisodes[index]!;

              emit({
                type: "encoding_start",
                data: {
                  pr_number: pullRequest.number,
                  title: pullRequest.title,
                },
              });

              emit({
                type: "episode_created",
                data: {
                  pr_number: pullRequest.number,
                  episode: cachedEpisode,
                  encoding_source: "cached",
                },
              });
            }

            emit({
              type: "complete",
              data: buildImportCompleteData({
                total: orderedCachedEpisodes.length,
                failed: 0,
                skipped: 0,
                repoId: repoRecordId,
                replayed: true,
                salienceBackfilled,
              }),
            });
            return;
          }

          console.warn("[import] replay cache incomplete; falling back to live import path");
        }

        for (const pr of pullRequests) {
          emit({
            type: "encoding_start",
            data: {
              pr_number: pr.number,
              title: pr.title,
            },
          });

          if (storageMode === "supabase" && existingPrNumbers.has(pr.number)) {
            skipped += 1;
            emit(skippedEvent(pr));
            continue;
          }

          try {
            const [reviews, diff] = await Promise.all([
              fetchPRReviews(owner, repo, pr.number, providerToken ?? undefined),
              fetchPRDiff(owner, repo, pr.number, providerToken ?? undefined),
            ]);

            const reviewComments = reviews.flatMap((review) => {
              const commentBodies = review.comments.map((comment) => comment.body);
              return review.body ? [review.body, ...commentBodies] : commentBodies;
            });

            const searchRules = await generateSearchRules(
              reviewComments,
              `repo=${owner}/${repo};pr=${pr.number};title=${pr.title}`,
            );

            const snippets = executeSearch(diff, searchRules.search_rules);
            const uniqueFileCount = new Set(snippets.map((snippet) => snippet.filePath)).size;
            emit({
              type: "snippets_extracted",
              data: {
                pr_number: pr.number,
                snippet_count: snippets.length,
                file_count: uniqueFileCount,
                search_rule_count: searchRules.search_rules.length,
              },
            });
            const reduction = summarizeTokenReduction(diff, snippets);

            const encoded = await encodeEpisode({
              owner,
              repo,
              pr,
              reviews,
              snippets: snippets.map((snippet) => snippet.text),
            });

            const insertedEpisode =
              storageMode === "supabase"
                ? await (async () => {
                    const { data, error: insertError } = await supabase
                      .from("episodes")
                      .insert({
                        repo_id: repoRecordId,
                        ...encoded.episode,
                      })
                      .select("id,title,source_pr_number,salience_score,pattern_key,the_pattern,what_happened,the_fix,why_it_matters,triggers")
                      .single();

                    if (insertError) {
                      throw insertError;
                    }

                    if (!data) {
                      throw new Error("Failed to create encoded episode");
                    }

                    return data as ImportEpisodeSummary;
                  })()
                : (() => {
                    const episode = insertEpisodeForRepo(repoRecordId, encoded.episode);
                    return {
                      id: episode.id,
                      title: episode.title,
                      source_pr_number: episode.source_pr_number,
                      salience_score: episode.salience_score,
                      pattern_key: episode.pattern_key,
                      the_pattern: episode.the_pattern,
                      what_happened: episode.what_happened,
                      the_fix: episode.the_fix,
                      why_it_matters: episode.why_it_matters,
                      triggers: episode.triggers,
                    } satisfies ImportEpisodeSummary;
                  })();

            created += 1;
            if (storageMode === "supabase") {
              existingPrNumbers.add(pr.number);
            }

            emit({
              type: "episode_created",
              data: {
                pr_number: pr.number,
                episode: insertedEpisode,
                encoding_source: "llm",
                review_count: encoded.reviewCount,
                snippet_count: encoded.snippetCount,
                token_reduction: reduction,
              },
            });
          } catch (error) {
            if (storageMode === "supabase" && isUniqueViolationError(error)) {
              skipped += 1;
              existingPrNumbers.add(pr.number);
              emit(skippedEvent(pr));
              continue;
            }

            failed += 1;
            const message =
              error instanceof Error
                ? error.message
                : typeof error === "object" && error && "message" in error
                  ? String((error as { message?: unknown }).message ?? "Failed to import PR")
                  : "Failed to import PR";

            emit({
              type: "encoding_error",
              data: {
                pr_number: pr.number,
                message,
              },
            });
          }
        }

        emit({
          type: "complete",
          data: buildImportCompleteData({
            total: created,
            failed,
            skipped,
            repoId: repoRecordId,
            salienceBackfilled,
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected import error";
        emit({
          type: "encoding_error",
          data: { message },
        });
        emit({ type: "complete", data: { total: 0, failed: 1, skipped: 0 } });
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
