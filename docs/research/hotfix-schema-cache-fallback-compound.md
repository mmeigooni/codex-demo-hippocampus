# Compounded Learning: Schema Cache Outage With Dev Fallback

## Problem
Import and consolidation flows were blocked in local/dev with:

- `Could not find the table 'public.profiles' in the schema cache`
- Import UI stalled into error states despite authenticated session.

## Root cause
PostgREST schema cache was unavailable for all app tables (`profiles`, `repos`, `episodes`, `rules`, `index_entries`, `consolidation_runs`) in the connected Supabase environment.

This made the previously-introduced strict fail-fast guard correct but too disruptive for local/demo development workflows.

## Solution
Implemented a dual storage mode with strict production behavior:

1. Preflight mode resolver (`resolveStorageModeAfterProfilesPreflight`) chooses:
- `supabase` when schema is healthy.
- `memory-fallback` only in local/dev on schema-cache miss.
- typed fail-fast error in production.

2. Added in-memory runtime store (`lib/fallback/runtime-memory-store.ts`) with user/repo isolation for:
- repos
- episodes
- rules
- consolidation runs

3. Routed both APIs through mode-aware execution:
- `/api/github/import`
- `/api/consolidate`

4. Updated pages and client UI:
- `/episodes` and `/sleep-cycle` read fallback data in local/dev.
- Dashboard/Sleep Cycle panels display explicit fallback-mode notices.
- API responses include `x-hippocampus-storage-mode` for observability.

## Why this is safe
- Production still fails fast on schema-cache drift.
- No privilege escalation or service-role bypass was introduced.
- Fallback data is process-local and user-scoped, minimizing blast radius.

## Known tradeoffs
- In-memory fallback is ephemeral (resets on server restart).
- Multi-process dev environments do not share fallback state.

## Reuse guidance
Use this pattern when local/dev must remain demonstrable under transient infrastructure failures:

1. Keep production strict.
2. Add explicit mode signaling.
3. Isolate fallback data by user and domain entity.
4. Ensure UI communicates degraded mode.
