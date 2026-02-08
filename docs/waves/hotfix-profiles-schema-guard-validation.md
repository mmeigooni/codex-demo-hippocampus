# Hotfix Validation: Profiles Schema Guard (2026-02-08)

## Scope
Fail-fast behavior when `public.profiles` is unavailable in Supabase schema cache.

## Behavior changes
- `POST /api/github/import` now returns `503` JSON with `code=SCHEMA_NOT_READY_PROFILES` before streaming begins.
- `POST /api/consolidate` now returns `503` JSON with the same payload contract before streaming begins.
- `/episodes` and `/sleep-cycle` render explicit schema-not-ready cards when profiles prequery reports cache-missing errors.

## Validation
- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm test` ✅
- `npm run build` ✅

## Manual regression checklist
- Unauthorized and missing-token behavior in import/repo routes is unchanged.
- Private repo rejection path remains unchanged.
- Non-schema profile query errors are not reclassified as schema-not-ready.
