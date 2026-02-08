import {
  fetchRepo,
  fetchMergedPRs,
  fetchPRDiff,
  fetchPRReviews,
} from "@/lib/github/client";
import type { ImportEvent, ImportRepoRequest } from "@/lib/github/types";
import { encodeEpisode } from "@/lib/codex/encoder";
import {
  executeSearch,
  generateSearchRules,
  summarizeTokenReduction,
} from "@/lib/codex/search";
import {
  isPrivateRepo,
  MISSING_PROVIDER_TOKEN_MESSAGE,
  PRIVATE_REPOS_NOT_SUPPORTED_MESSAGE,
} from "@/lib/github/public-only-policy";
import {
  assertProfilesSchemaReady,
  isProfilesSchemaNotReadyError,
  SCHEMA_NOT_READY_PROFILES_CODE,
} from "@/lib/supabase/schema-guard";
import { createServerClient } from "@/lib/supabase/server";

function buildSseMessage(event: ImportEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

interface ProfileUserContext {
  id: string;
  githubUsername: string | null;
  avatarUrl: string | null;
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
  const [userResult, sessionResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  const user = userResult.data.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providerToken = sessionResult.data.session?.provider_token;
  if (!providerToken) {
    return Response.json(
      {
        error: MISSING_PROVIDER_TOKEN_MESSAGE,
      },
      { status: 400 },
    );
  }
  const userContext: ProfileUserContext = {
    id: user.id,
    githubUsername: user.user_metadata?.user_name ?? user.user_metadata?.preferred_username ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };

  try {
    const targetRepo = await fetchRepo(owner, repo, providerToken);
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

  try {
    await assertProfilesSchemaReady(supabase);
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
      const emit = (event: ImportEvent) => {
        controller.enqueue(encoder.encode(buildSseMessage(event)));
      };

      try {
        const profileId = await ensureProfileId(userContext, supabase);

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

        const pullRequests = await fetchMergedPRs(owner, repo, 20, providerToken);
        emit({ type: "pr_found", data: { count: pullRequests.length } });

        let created = 0;

        for (const pr of pullRequests) {
          emit({
            type: "encoding_start",
            data: {
              pr_number: pr.number,
              title: pr.title,
            },
          });

          try {
            const [reviews, diff] = await Promise.all([
              fetchPRReviews(owner, repo, pr.number, providerToken),
              fetchPRDiff(owner, repo, pr.number, providerToken),
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
            const reduction = summarizeTokenReduction(diff, snippets);

            const encoded = await encodeEpisode({
              owner,
              repo,
              pr,
              reviews,
              snippets: snippets.map((snippet) => snippet.text),
            });

            const { data: insertedEpisode, error: insertError } = await supabase
              .from("episodes")
              .insert({
                repo_id: repoRecord.id,
                ...encoded.episode,
              })
              .select("id,title,source_pr_number,salience_score,the_pattern,triggers")
              .single();

            if (insertError || !insertedEpisode) {
              throw new Error(insertError?.message ?? "Failed to create encoded episode");
            }

            created += 1;
            emit({
              type: "episode_created",
              data: {
                episode: insertedEpisode,
                review_count: encoded.reviewCount,
                snippet_count: encoded.snippetCount,
                token_reduction: reduction,
              },
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to import PR";
            emit({
              type: "encoding_error",
              data: {
                pr_number: pr.number,
                message,
              },
            });
          }
        }

        emit({ type: "complete", data: { total: created } });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected import error";
        emit({
          type: "encoding_error",
          data: { message },
        });
        emit({ type: "complete", data: { total: 0 } });
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
    },
  });
}
