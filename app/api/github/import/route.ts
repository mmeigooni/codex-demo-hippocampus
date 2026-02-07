import { fetchMergedPRs } from "@/lib/github/client";
import type { ImportEvent, ImportRepoRequest } from "@/lib/github/types";
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
            const { data: episode, error: episodeError } = await supabase
              .from("episodes")
              .insert({
                repo_id: repoRecord.id,
                source_pr_number: pr.number,
                title: pr.title,
                who: pr.authorLogin,
                what_happened: `Imported PR #${pr.number} (${pr.title}) from ${fullName}`,
                the_pattern: "placeholder",
                the_fix: "placeholder",
                why_it_matters: "placeholder",
                salience_score: 3,
                triggers: ["imported", "placeholder"],
                source_url: pr.htmlUrl,
                happened_at: pr.mergedAt,
              })
              .select("id,title,source_pr_number")
              .single();

            if (episodeError || !episode) {
              throw new Error(episodeError?.message ?? "Failed to create placeholder episode");
            }

            created += 1;
            emit({
              type: "episode_created",
              data: {
                episode,
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
