import type { EpisodeInsertPayload } from "@/lib/codex/types";

export interface RuntimeRepoRecord {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  source: string;
  connected_by_profile_id: string;
  created_at: string;
  updated_at: string;
}

export interface RuntimeEpisodeRecord extends EpisodeInsertPayload {
  id: string;
  repo_id: string;
  created_at: string;
  updated_at: string;
}

export interface RuntimeRuleRecord {
  id: string;
  repo_id: string;
  title: string;
  description: string;
  triggers: string[];
  source_episode_ids: string[];
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface RuntimeConsolidationRunRecord {
  id: string;
  repo_id: string;
  status: "running" | "completed" | "failed";
  summary: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
}

interface RuntimeStoreState {
  reposByUser: Map<string, Map<string, RuntimeRepoRecord>>;
  episodesByRepo: Map<string, RuntimeEpisodeRecord[]>;
  rulesByRepo: Map<string, RuntimeRuleRecord[]>;
  runsByRepo: Map<string, RuntimeConsolidationRunRecord[]>;
  runRepoIndex: Map<string, string>;
}

declare global {
  var __hippocampusRuntimeStoreState: RuntimeStoreState | undefined;
}

function createState(): RuntimeStoreState {
  return {
    reposByUser: new Map(),
    episodesByRepo: new Map(),
    rulesByRepo: new Map(),
    runsByRepo: new Map(),
    runRepoIndex: new Map(),
  };
}

function getState(): RuntimeStoreState {
  if (!globalThis.__hippocampusRuntimeStoreState) {
    globalThis.__hippocampusRuntimeStoreState = createState();
  }

  return globalThis.__hippocampusRuntimeStoreState;
}

function nowIso() {
  return new Date().toISOString();
}

function cloneRepo(repo: RuntimeRepoRecord): RuntimeRepoRecord {
  return { ...repo };
}

function cloneEpisode(episode: RuntimeEpisodeRecord): RuntimeEpisodeRecord {
  return { ...episode, triggers: [...episode.triggers] };
}

function cloneRule(rule: RuntimeRuleRecord): RuntimeRuleRecord {
  return {
    ...rule,
    triggers: [...rule.triggers],
    source_episode_ids: [...rule.source_episode_ids],
  };
}

function cloneRun(run: RuntimeConsolidationRunRecord): RuntimeConsolidationRunRecord {
  return {
    ...run,
    summary: { ...run.summary },
  };
}

function sortByTimestampDescending<T extends { updated_at?: string; created_at?: string; started_at?: string }>(
  values: T[],
) {
  return [...values].sort((left, right) => {
    const leftTimestamp = left.updated_at ?? left.created_at ?? left.started_at ?? "";
    const rightTimestamp = right.updated_at ?? right.created_at ?? right.started_at ?? "";
    return rightTimestamp.localeCompare(leftTimestamp);
  });
}

function getOrCreateUserRepos(userId: string) {
  const state = getState();
  const existing = state.reposByUser.get(userId);
  if (existing) {
    return existing;
  }

  const repos = new Map<string, RuntimeRepoRecord>();
  state.reposByUser.set(userId, repos);
  return repos;
}

export function resetRuntimeMemoryStore() {
  globalThis.__hippocampusRuntimeStoreState = createState();
}

export function isRuntimeMemoryStoreEmpty() {
  const state = getState();
  return (
    state.reposByUser.size === 0 &&
    state.episodesByRepo.size === 0 &&
    state.rulesByRepo.size === 0 &&
    state.runsByRepo.size === 0
  );
}

interface UpsertRepoForUserInput {
  userId: string;
  owner: string;
  name: string;
  fullName: string;
  source?: string;
}

export function upsertRepoForUser(input: UpsertRepoForUserInput): RuntimeRepoRecord {
  const repos = getOrCreateUserRepos(input.userId);
  const existing = Array.from(repos.values()).find((repo) => repo.full_name === input.fullName);
  const timestamp = nowIso();

  if (existing) {
    const updated: RuntimeRepoRecord = {
      ...existing,
      owner: input.owner,
      name: input.name,
      full_name: input.fullName,
      source: input.source ?? existing.source,
      updated_at: timestamp,
    };
    repos.set(updated.id, updated);
    return cloneRepo(updated);
  }

  const created: RuntimeRepoRecord = {
    id: crypto.randomUUID(),
    owner: input.owner,
    name: input.name,
    full_name: input.fullName,
    source: input.source ?? "github",
    connected_by_profile_id: input.userId,
    created_at: timestamp,
    updated_at: timestamp,
  };
  repos.set(created.id, created);
  return cloneRepo(created);
}

export function listReposForUser(userId: string): RuntimeRepoRecord[] {
  const repos = getState().reposByUser.get(userId);
  if (!repos) {
    return [];
  }

  return sortByTimestampDescending(Array.from(repos.values())).map(cloneRepo);
}

export function findRepoByIdForUser(userId: string, repoId: string): RuntimeRepoRecord | null {
  const repos = getState().reposByUser.get(userId);
  if (!repos) {
    return null;
  }

  const repo = repos.get(repoId);
  return repo ? cloneRepo(repo) : null;
}

export function insertEpisodeForRepo(repoId: string, payload: EpisodeInsertPayload): RuntimeEpisodeRecord {
  const state = getState();
  const timestamp = nowIso();
  const episodes = state.episodesByRepo.get(repoId) ?? [];
  const episode: RuntimeEpisodeRecord = {
    id: crypto.randomUUID(),
    repo_id: repoId,
    source_pr_number: payload.source_pr_number,
    title: payload.title,
    who: payload.who,
    what_happened: payload.what_happened,
    the_pattern: payload.the_pattern,
    the_fix: payload.the_fix,
    why_it_matters: payload.why_it_matters,
    salience_score: payload.salience_score,
    triggers: [...payload.triggers],
    source_url: payload.source_url,
    happened_at: payload.happened_at,
    created_at: timestamp,
    updated_at: timestamp,
  };

  episodes.push(episode);
  state.episodesByRepo.set(repoId, episodes);
  return cloneEpisode(episode);
}

export function listEpisodesForRepo(repoId: string): RuntimeEpisodeRecord[] {
  const episodes = getState().episodesByRepo.get(repoId) ?? [];
  return sortByTimestampDescending(episodes).map(cloneEpisode);
}

export function listEpisodesForUser(userId: string): RuntimeEpisodeRecord[] {
  const repos = listReposForUser(userId);
  return repos.flatMap((repo) => listEpisodesForRepo(repo.id));
}

export function listRulesForRepo(repoId: string): RuntimeRuleRecord[] {
  const rules = getState().rulesByRepo.get(repoId) ?? [];
  return sortByTimestampDescending(rules).map(cloneRule);
}

interface UpsertRuleInput {
  title: string;
  description: string;
  triggers: string[];
  source_episode_ids: string[];
  confidence: number;
}

export function upsertRulesForRepo(repoId: string, inputs: UpsertRuleInput[]): RuntimeRuleRecord[] {
  const state = getState();
  const rules = state.rulesByRepo.get(repoId) ?? [];

  for (const input of inputs) {
    const now = nowIso();
    const existing = rules.find((rule) => rule.title.toLowerCase() === input.title.toLowerCase());

    if (existing) {
      existing.description = input.description;
      existing.triggers = [...input.triggers];
      existing.source_episode_ids = [...input.source_episode_ids];
      existing.confidence = input.confidence;
      existing.updated_at = now;
      continue;
    }

    rules.push({
      id: crypto.randomUUID(),
      repo_id: repoId,
      title: input.title,
      description: input.description,
      triggers: [...input.triggers],
      source_episode_ids: [...input.source_episode_ids],
      confidence: input.confidence,
      created_at: now,
      updated_at: now,
    });
  }

  state.rulesByRepo.set(repoId, rules);
  return listRulesForRepo(repoId);
}

export function createConsolidationRun(repoId: string): RuntimeConsolidationRunRecord {
  const state = getState();
  const runs = state.runsByRepo.get(repoId) ?? [];
  const run: RuntimeConsolidationRunRecord = {
    id: crypto.randomUUID(),
    repo_id: repoId,
    status: "running",
    summary: {},
    started_at: nowIso(),
    completed_at: null,
  };

  runs.push(run);
  state.runsByRepo.set(repoId, runs);
  state.runRepoIndex.set(run.id, repoId);
  return cloneRun(run);
}

export function completeConsolidationRun(runId: string, summary: Record<string, unknown>) {
  const state = getState();
  const repoId = state.runRepoIndex.get(runId);
  if (!repoId) {
    return null;
  }

  const runs = state.runsByRepo.get(repoId) ?? [];
  const run = runs.find((entry) => entry.id === runId);
  if (!run) {
    return null;
  }

  run.status = "completed";
  run.summary = { ...summary };
  run.completed_at = nowIso();
  return cloneRun(run);
}

export function failConsolidationRun(runId: string, errorMessage: string) {
  const state = getState();
  const repoId = state.runRepoIndex.get(runId);
  if (!repoId) {
    return null;
  }

  const runs = state.runsByRepo.get(repoId) ?? [];
  const run = runs.find((entry) => entry.id === runId);
  if (!run) {
    return null;
  }

  run.status = "failed";
  run.summary = { error: errorMessage };
  run.completed_at = nowIso();
  return cloneRun(run);
}

export function latestCompletedRunForRepo(repoId: string): RuntimeConsolidationRunRecord | null {
  const runs = getState().runsByRepo.get(repoId) ?? [];
  const completed = runs.filter((run) => run.status === "completed");
  if (completed.length === 0) {
    return null;
  }

  const [latest] = sortByTimestampDescending(completed);
  return latest ? cloneRun(latest) : null;
}

interface SalienceUpdateInput {
  episode_id: string;
  salience_score: number;
}

export function applySalienceUpdates(repoId: string, updates: SalienceUpdateInput[]) {
  const state = getState();
  const episodes = state.episodesByRepo.get(repoId) ?? [];
  const scoreByEpisode = new Map(updates.map((update) => [update.episode_id, update.salience_score]));

  for (const episode of episodes) {
    const maybeScore = scoreByEpisode.get(episode.id);
    if (typeof maybeScore !== "number") {
      continue;
    }

    episode.salience_score = maybeScore;
    episode.updated_at = nowIso();
  }

  state.episodesByRepo.set(repoId, episodes);
}
