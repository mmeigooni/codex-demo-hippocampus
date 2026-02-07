# Wave 09 Handoff Validation (2026-02-07)

## Targeted checks
- SSE events render as animated feed cards with salience/trigger metadata.
- Brain graph updates from `episode_created` event stream in the same view.
- Dashboard transitions remain coherent under import lifecycle phases.

## Critical regression checks
- `/` login entry still renders.
- unauthenticated `/dashboard` redirect remains active.
- Repo selection and import kickoff are still reachable from dashboard.

## Validation commands
- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Chrome DevTools gate
- Pending in-session due unavailable MCP namespace; requires session reload to execute requested DevTools checks.
