import { EpisodesExplorer } from "@/components/episodes/EpisodesExplorer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerClient } from "@/lib/supabase/server";

function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

export default async function EpisodesPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-zinc-100">Episodes</h2>
        </div>
        <Card className="border-zinc-800 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-zinc-100">Authentication required</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-300">
            Sign in to browse episodic memory extracted from pull requests.
          </CardContent>
        </Card>
      </section>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: repos } = profile?.id
    ? await supabase
        .from("repos")
        .select("id, full_name")
        .eq("connected_by_profile_id", profile.id)
    : { data: [] as Array<{ id: string; full_name: string }> };

  const repoMap = new Map((repos ?? []).map((repo) => [repo.id, repo.full_name]));
  const repoIds = Array.from(repoMap.keys());

  const { data: episodes } =
    repoIds.length > 0
      ? await supabase
          .from("episodes")
          .select(
            "id,repo_id,title,who,what_happened,the_pattern,the_fix,why_it_matters,salience_score,triggers,source_url,happened_at,source_pr_number",
          )
          .in("repo_id", repoIds)
          .order("created_at", { ascending: false })
          .limit(300)
      : { data: [] as Array<Record<string, unknown>> };

  const mappedEpisodes = (episodes ?? []).map((episode) => ({
    id: String(episode.id),
    title: String(episode.title ?? "Untitled episode"),
    repoFullName: repoMap.get(String(episode.repo_id)) ?? "unknown/repo",
    who: typeof episode.who === "string" ? episode.who : null,
    whatHappened: typeof episode.what_happened === "string" ? episode.what_happened : null,
    pattern: typeof episode.the_pattern === "string" ? episode.the_pattern : null,
    fix: typeof episode.the_fix === "string" ? episode.the_fix : null,
    whyItMatters: typeof episode.why_it_matters === "string" ? episode.why_it_matters : null,
    salience: Number(episode.salience_score ?? 0),
    triggers: normalizeTextArray(episode.triggers),
    sourceUrl: typeof episode.source_url === "string" ? episode.source_url : null,
    happenedAt: typeof episode.happened_at === "string" ? episode.happened_at : null,
    sourcePrNumber: typeof episode.source_pr_number === "number" ? episode.source_pr_number : null,
  }));

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-zinc-100">Episodes</h2>
        <p className="text-zinc-300">
          Explore encoded incidents and inspect who/what/pattern/fix/why context for each episode.
        </p>
      </div>

      <EpisodesExplorer episodes={mappedEpisodes} />
    </section>
  );
}
