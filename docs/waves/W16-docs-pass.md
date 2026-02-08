# Wave 16 Docs Pass (2026-02-08)

## Scope
Import idempotency + re-import UX clarity for dashboard onboarding flow.

## Sources checked
- `app/api/github/import/route.ts`
- `components/onboarding/OnboardingFlow.tsx`
- `supabase/migrations/003_episodes_idempotent.sql`
- Supabase Postgres guidance: partial/composite indexes and conflict-safe write patterns.

## Outcome
- Added migration to deduplicate PR-backed episodes and enforce uniqueness with a partial unique index:
  - `(repo_id, source_pr_number)` where `source_pr_number is not null`
- Added Supabase-only import dedupe flow in import SSE route:
  - pre-query existing PR numbers
  - emit `episode_skipped` for already-imported PRs
  - include `skipped` in `complete` payload
  - handle `23505` unique violations as graceful skips
- Added import idempotency helper module + tests.
- Updated onboarding feed/status UX:
  - renders `episode_skipped` activity cards
  - completion messaging includes `already imported` counts
  - graph panel labels preloaded data as existing snapshot during import.

## Post-migration note
- `rules.source_episode_ids` remap is intentionally out of scope in SQL migration.
- Run Sleep Cycle after deployment for affected repos to regenerate derived rule references.
