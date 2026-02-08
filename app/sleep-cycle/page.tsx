import { SleepCyclePanel } from "@/components/sleep-cycle/SleepCyclePanel";
import type { ConsolidationModelOutput } from "@/lib/codex/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isMissingProfilesTableError, SCHEMA_NOT_READY_PROFILES_MESSAGE } from "@/lib/supabase/schema-guard";
import { createServerClient } from "@/lib/supabase/server";

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

export default async function SleepCyclePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-zinc-100">Sleep Cycle</h2>
        </div>
        <Card className="border-zinc-800 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-zinc-100">Authentication required</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-300">
            Sign in to run consolidation and view dream-state outputs.
          </CardContent>
        </Card>
      </section>
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError && isMissingProfilesTableError(profileError)) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-zinc-100">Sleep Cycle</h2>
        </div>
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="text-amber-100">Schema not ready</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-100/90">{SCHEMA_NOT_READY_PROFILES_MESSAGE}</CardContent>
        </Card>
      </section>
    );
  }

  const { data: repos } = profile?.id
    ? await supabase
        .from("repos")
        .select("id, full_name")
        .eq("connected_by_profile_id", profile.id)
        .order("updated_at", { ascending: false })
    : { data: [] as Array<{ id: string; full_name: string }> };

  const mappedRepos = await Promise.all(
    (repos ?? []).map(async (repo) => {
      const [episodesResult, rulesResult] = await Promise.all([
        supabase.from("episodes").select("id", { count: "exact", head: true }).eq("repo_id", repo.id),
        supabase.from("rules").select("id", { count: "exact", head: true }).eq("repo_id", repo.id),
      ]);

      return {
        id: repo.id,
        fullName: repo.full_name,
        episodeCount: episodesResult.count ?? 0,
        ruleCount: rulesResult.count ?? 0,
      };
    }),
  );

  const defaultRepoId = mappedRepos[0]?.id ?? null;

  const { data: latestRun } = defaultRepoId
    ? await supabase
        .from("consolidation_runs")
        .select("summary")
        .eq("repo_id", defaultRepoId)
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null as { summary?: unknown } | null };

  const latestPack = normalizePack((latestRun?.summary as { pack?: unknown } | null)?.pack);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-zinc-100">Sleep Cycle</h2>
        <p className="text-zinc-300">
          Consolidate episodes into durable rules and memory salience updates while tracking the live dream-state stream.
        </p>
      </div>

      <SleepCyclePanel repos={mappedRepos} defaultRepoId={defaultRepoId} initialPack={latestPack} />
    </section>
  );
}
