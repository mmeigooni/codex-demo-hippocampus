import type { BrainEdgeModel, BrainNodeModel } from "@/components/brain/types";
import {
  findRepoByFullNameForUser,
  listEpisodesForRepo,
  listRulesForRepo,
} from "@/lib/fallback/runtime-memory-store";
import {
  isProfilesSchemaNotReadyError,
  resolveStorageModeAfterProfilesPreflight,
  SCHEMA_NOT_READY_PROFILES_CODE,
  type StorageMode,
} from "@/lib/supabase/schema-guard";
import { createServerClient } from "@/lib/supabase/server";

interface EpisodeGraphRecord {
  id: string;
  title: string;
  salience_score: number;
  triggers: string[];
}

interface RuleGraphRecord {
  id: string;
  title: string;
  confidence: number;
  triggers: string[];
  source_episode_ids: string[];
}

function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(10, Math.round(score)));
}

export function buildGraph(episodes: EpisodeGraphRecord[], rules: RuleGraphRecord[]) {
  const nodes: BrainNodeModel[] = [];
  const edges: BrainEdgeModel[] = [];
  const episodeSalience = new Map<string, number>();
  const episodeNodesById = new Map<string, BrainNodeModel>();

  for (const episode of episodes) {
    const nodeId = `episode-${episode.id}`;
    const salience = clampScore(episode.salience_score);
    episodeSalience.set(episode.id, salience);

    const episodeNode: BrainNodeModel = {
      id: nodeId,
      type: "episode",
      label: episode.title,
      salience,
      triggers: episode.triggers,
    };

    nodes.push(episodeNode);
    episodeNodesById.set(episode.id, episodeNode);
  }

  for (const rule of rules) {
    const linkedScores = rule.source_episode_ids
      .map((episodeId) => episodeSalience.get(episodeId))
      .filter((score): score is number => typeof score === "number");

    const derivedSalience =
      linkedScores.length > 0
        ? linkedScores.reduce((sum, score) => sum + score, 0) / linkedScores.length
        : rule.confidence * 10;

    const ruleNodeId = `rule-${rule.id}`;
    nodes.push({
      id: ruleNodeId,
      type: "rule",
      label: rule.title,
      salience: Math.max(4, clampScore(derivedSalience)),
      triggers: rule.triggers,
    });

    for (const sourceEpisodeId of rule.source_episode_ids) {
      if (!episodeSalience.has(sourceEpisodeId)) {
        continue;
      }

      const episodeNode = episodeNodesById.get(sourceEpisodeId);
      if (episodeNode && !episodeNode.ruleId) {
        episodeNode.ruleId = rule.id;
      }

      const edgeWeight = Math.max(0.2, Math.min(1, (episodeSalience.get(sourceEpisodeId) ?? 0) / 10));
      edges.push({
        id: `episode-${sourceEpisodeId}-${ruleNodeId}`,
        source: `episode-${sourceEpisodeId}`,
        target: ruleNodeId,
        weight: edgeWeight,
      });
    }
  }

  return {
    nodes,
    edges,
    stats: {
      episodeCount: episodes.length,
      ruleCount: rules.length,
    },
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const owner = url.searchParams.get("owner")?.trim();
  const repo = url.searchParams.get("repo")?.trim();

  if (!owner || !repo) {
    return Response.json({ error: "owner and repo query params are required" }, { status: 400 });
  }

  const fullName = `${owner}/${repo}`;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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

  if (storageMode === "memory-fallback") {
    const selectedRepo = findRepoByFullNameForUser(user.id, fullName);
    if (!selectedRepo) {
      return Response.json(buildGraph([], []));
    }

    const episodes = listEpisodesForRepo(selectedRepo.id).map((episode) => ({
      id: episode.id,
      title: episode.title,
      salience_score: Number(episode.salience_score ?? 0),
      triggers: normalizeTextArray(episode.triggers),
    }));
    const rules = listRulesForRepo(selectedRepo.id).map((rule) => ({
      id: rule.id,
      title: rule.title,
      confidence: Number(rule.confidence ?? 0),
      triggers: normalizeTextArray(rule.triggers),
      source_episode_ids: normalizeTextArray(rule.source_episode_ids),
    }));

    return Response.json(buildGraph(episodes, rules));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile?.id) {
    return Response.json(buildGraph([], []));
  }

  const { data: selectedRepo, error: repoError } = await supabase
    .from("repos")
    .select("id")
    .eq("connected_by_profile_id", profile.id)
    .eq("owner", owner)
    .eq("name", repo)
    .maybeSingle();

  if (repoError) {
    return Response.json({ error: repoError.message }, { status: 500 });
  }

  if (!selectedRepo?.id) {
    return Response.json(buildGraph([], []));
  }

  const [episodesResponse, rulesResponse] = await Promise.all([
    supabase
      .from("episodes")
      .select("id,title,salience_score,triggers")
      .eq("repo_id", selectedRepo.id)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("rules")
      .select("id,title,confidence,triggers,source_episode_ids")
      .eq("repo_id", selectedRepo.id)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);

  if (episodesResponse.error) {
    return Response.json({ error: episodesResponse.error.message }, { status: 500 });
  }

  if (rulesResponse.error) {
    return Response.json({ error: rulesResponse.error.message }, { status: 500 });
  }

  const episodes = (episodesResponse.data ?? []).map((episode) => ({
    id: episode.id,
    title: episode.title,
    salience_score: Number(episode.salience_score ?? 0),
    triggers: normalizeTextArray(episode.triggers),
  }));
  const rules = (rulesResponse.data ?? []).map((rule) => ({
    id: rule.id,
    title: rule.title,
    confidence: Number(rule.confidence ?? 0),
    triggers: normalizeTextArray(rule.triggers),
    source_episode_ids: normalizeTextArray(rule.source_episode_ids),
  }));

  return Response.json(buildGraph(episodes, rules));
}
