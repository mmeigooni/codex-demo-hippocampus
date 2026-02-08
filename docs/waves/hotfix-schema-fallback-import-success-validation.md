# Hotfix Validation: Dev Fallback Import Success (2026-02-08)

## Scope
Restore local/dev import + consolidation behavior when Supabase PostgREST schema cache cannot resolve app tables.

## Behavior changes
- `POST /api/github/import` now selects storage mode after schema preflight:
  - `supabase` when schema is ready.
  - `memory-fallback` in local/dev when `public.profiles` is missing in schema cache.
  - strict `503` in production for schema-missing states.
- `POST /api/consolidate` now mirrors the same mode selection and fallback.
- `/episodes` and `/sleep-cycle` now render data from fallback storage in local/dev when schema cache is unavailable.
- Dashboard and Sleep Cycle panels now show non-blocking fallback-mode notices when active.

## Supabase/Postgres best-practices review (applied)
- Keep production fail-fast to surface operational schema drift.
- Keep least-privilege posture (no service-role bypass added for this hotfix).
- Add explicit runtime signaling (`x-hippocampus-storage-mode`) and UI notices to avoid silent degradation.
- Keep user/repo isolation in fallback store to prevent cross-user data bleed.

## Automated validation
- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm test` ✅
- `npm run build` ✅

## Chrome DevTools audit evidence
- Opened authenticated `/dashboard`.
- Clicked `Import mmeigooni/shopflow-platform`.
- Network request observed:
  - `POST /api/github/import` -> `200` (reqid 93)
- UI observed during stream:
  - `Import in progress. Neural feed is live.`
  - fallback notice: `Local fallback mode active...`
  - multiple `EPISODE_CREATED` entries rendered in live feed.
- This confirms end-to-end import execution succeeded in fallback mode with live episode creation.

## Manual follow-up checks
- Visit `/episodes` after import and verify imported episodes are visible.
- Visit `/sleep-cycle`, run consolidation, and verify `consolidation_start` -> `consolidation_complete` lifecycle.
- In production mode, verify schema-cache miss still returns `503` + `SCHEMA_NOT_READY_PROFILES`.
