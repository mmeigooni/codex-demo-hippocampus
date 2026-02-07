import {
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
import { createServerClient } from "@/lib/supabase/server";

function getFallbackGitHubToken() {
  return process.env.GITHUB_TOKEN ?? null;
}

function buildSseMessage(event: ImportEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function ensureProfileId(userId: string, supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingProfile?.id) {
    return existingProfile.id;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: createdProfile, error } = await supabase
    .from("profiles")
    .insert({
      user_id: userId,
      github_username: user?.user_metadata?.user_name ?? user?.user_metadata?.preferred_username ?? null,
      avatar_url: user?.user_metadata?.avatar_url ?? null,
    })
    .select("id")
    .single();

  if (error || !createdProfile?.id) {
    throw new Error(error?.message ?? "Failed to create profile");
  }

  return createdProfile.id;
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: ImportEvent) => {
        controller.enqueue(encoder.encode(buildSseMessage(event)));
      };

      try {
        const body = (await request.json()) as Partial<ImportRepoRequest>;
        const owner = body.owner?.trim();
        const repo = body.repo?.trim();

        if (!owner || !repo) {
          emit({ type: "encoding_error", data: { message: "owner and repo are required" } });
          emit({ type: "complete", data: { total: 0 } });
          controller.close();
          return;
        }

        const supabase = await createServerClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          emit({ type: "encoding_error", data: { message: "Unauthorized" } });
          emit({ type: "complete", data: { total: 0 } });
          controller.close();
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const providerToken = session?.provider_token ?? getFallbackGitHubToken() ?? undefined;
        const profileId = await ensureProfileId(user.id, supabase);

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
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected import error";
        controller.enqueue(
          encoder.encode(
            buildSseMessage({
              type: "encoding_error",
              data: { message },
            }),
          ),
        );
        controller.enqueue(encoder.encode(buildSseMessage({ type: "complete", data: { total: 0 } })));
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
