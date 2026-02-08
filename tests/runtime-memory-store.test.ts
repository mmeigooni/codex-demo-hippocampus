import { beforeEach, describe, expect, it } from "vitest";

import {
  applySalienceUpdates,
  completeConsolidationRun,
  createConsolidationRun,
  failConsolidationRun,
  findRepoByIdForUser,
  insertEpisodeForRepo,
  isRuntimeMemoryStoreEmpty,
  latestCompletedRunForRepo,
  listEpisodesForRepo,
  listEpisodesForUser,
  listReposForUser,
  listRulesForRepo,
  resetRuntimeMemoryStore,
  upsertRepoForUser,
  upsertRulesForRepo,
} from "@/lib/fallback/runtime-memory-store";

beforeEach(() => {
  resetRuntimeMemoryStore();
});

describe("runtime memory store", () => {
  it("upserts repos idempotently per user", () => {
    const first = upsertRepoForUser({
      userId: "u1",
      owner: "acme",
      name: "demo",
      fullName: "acme/demo",
    });

    const second = upsertRepoForUser({
      userId: "u1",
      owner: "acme",
      name: "demo",
      fullName: "acme/demo",
    });

    expect(first.id).toBe(second.id);
    expect(listReposForUser("u1")).toHaveLength(1);
  });

  it("isolates repos across users", () => {
    upsertRepoForUser({ userId: "u1", owner: "acme", name: "one", fullName: "acme/one" });
    upsertRepoForUser({ userId: "u2", owner: "acme", name: "one", fullName: "acme/one" });

    expect(listReposForUser("u1")).toHaveLength(1);
    expect(listReposForUser("u2")).toHaveLength(1);
    expect(listReposForUser("u1")[0]?.id).not.toBe(listReposForUser("u2")[0]?.id);
  });

  it("stores and lists episodes by repo and user", () => {
    const repo = upsertRepoForUser({ userId: "u1", owner: "acme", name: "one", fullName: "acme/one" });
    insertEpisodeForRepo(repo.id, {
      source_pr_number: 1,
      title: "Episode A",
      who: "dev1",
      what_happened: "A",
      the_pattern: "pattern-a",
      the_fix: "fix-a",
      why_it_matters: "matters-a",
      salience_score: 4,
      triggers: ["a"],
      source_url: "https://example.com/a",
      happened_at: "2026-01-01T00:00:00.000Z",
    });
    insertEpisodeForRepo(repo.id, {
      source_pr_number: 2,
      title: "Episode B",
      who: "dev2",
      what_happened: "B",
      the_pattern: "pattern-b",
      the_fix: "fix-b",
      why_it_matters: "matters-b",
      salience_score: 7,
      triggers: ["b"],
      source_url: "https://example.com/b",
      happened_at: "2026-01-02T00:00:00.000Z",
    });

    expect(listEpisodesForRepo(repo.id)).toHaveLength(2);
    expect(listEpisodesForUser("u1")).toHaveLength(2);
  });

  it("upserts rules and updates existing title matches", () => {
    const repo = upsertRepoForUser({ userId: "u1", owner: "acme", name: "one", fullName: "acme/one" });
    upsertRulesForRepo(repo.id, [
      {
        title: "Guard rails",
        description: "first",
        triggers: ["a"],
        source_episode_ids: ["e1"],
        confidence: 0.4,
      },
    ]);
    upsertRulesForRepo(repo.id, [
      {
        title: "guard rails",
        description: "second",
        triggers: ["a", "b"],
        source_episode_ids: ["e2"],
        confidence: 0.9,
      },
    ]);

    const rules = listRulesForRepo(repo.id);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.description).toBe("second");
    expect(rules[0]?.confidence).toBe(0.9);
  });

  it("handles consolidation run lifecycle and latest completed lookup", () => {
    const repo = upsertRepoForUser({ userId: "u1", owner: "acme", name: "one", fullName: "acme/one" });
    const run1 = createConsolidationRun(repo.id);
    failConsolidationRun(run1.id, "boom");
    const run2 = createConsolidationRun(repo.id);
    completeConsolidationRun(run2.id, { ok: true });

    const latest = latestCompletedRunForRepo(repo.id);
    expect(latest?.id).toBe(run2.id);
    expect(latest?.status).toBe("completed");
  });

  it("applies salience updates by episode id", () => {
    const repo = upsertRepoForUser({ userId: "u1", owner: "acme", name: "one", fullName: "acme/one" });
    const episode = insertEpisodeForRepo(repo.id, {
      source_pr_number: 1,
      title: "Episode A",
      who: "dev1",
      what_happened: "A",
      the_pattern: "pattern-a",
      the_fix: "fix-a",
      why_it_matters: "matters-a",
      salience_score: 3,
      triggers: ["a"],
      source_url: "https://example.com/a",
      happened_at: "2026-01-01T00:00:00.000Z",
    });

    applySalienceUpdates(repo.id, [{ episode_id: episode.id, salience_score: 9 }]);

    expect(listEpisodesForRepo(repo.id)[0]?.salience_score).toBe(9);
  });

  it("exposes find-by-id and empty-state helpers", () => {
    expect(isRuntimeMemoryStoreEmpty()).toBe(true);
    const repo = upsertRepoForUser({ userId: "u1", owner: "acme", name: "one", fullName: "acme/one" });
    expect(findRepoByIdForUser("u1", repo.id)?.id).toBe(repo.id);
    expect(isRuntimeMemoryStoreEmpty()).toBe(false);
  });
});
