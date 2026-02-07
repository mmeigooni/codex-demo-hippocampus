# Wave 07 Handoff Validation (2026-02-07)

## Targeted checks
- Import route now uses `fetchPRReviews` + `fetchPRDiff` + `encodeEpisode` pipeline.
- SSE `episode_created` includes review/snippet counts and token reduction summary.
- Encoder enforces output schema and clamps salience score/triggers.

## Regression checks
- Existing `/api/github/repos` route remains unchanged and available.
- Dashboard onboarding still triggers `/api/github/import` stream.
- Build remains green after introducing native ast-grep dependency.

## Validation commands
- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Chrome DevTools gate
- Pending in-session due unavailable MCP tool namespace; configuration for server is already present in `~/.codex/config.toml`.
