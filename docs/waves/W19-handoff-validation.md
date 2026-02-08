# Wave 19 Handoff Validation (2026-02-08)

## Targeted checks
- Consolidator uses streamed SDK path only when callbacks are provided and preserves non-streaming behavior when omitted.
- Consolidation route emits reasoning/response lifecycle SSE events during LLM execution for both supabase and memory-fallback flows.
- Reasoning delta emission is throttled and flushes pending payloads on completion/error.
- Distribution route emits branch/file/pr-creating events before `pr_created` in successful PR path.
- Distribution fallback behavior and markdown completion path remain intact.

## Validation commands
- `npx tsc --noEmit` ✅
- `npm test` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual SSE smoke checks
- `curl -i -N -X POST http://localhost:3000/api/consolidate -H 'Content-Type: application/json' -d '{"repo_id":"repo-1"}' --max-time 15` → `401 Unauthorized` (expected without authenticated session cookie)
- `curl -i -N -X POST http://localhost:3000/api/distribute -H 'Content-Type: application/json' -d '{"repo_id":"repo-1"}' --max-time 15` → `401 Unauthorized` (expected without authenticated session cookie)

## Follow-up manual validation in authenticated session
1. Sign in via GitHub and ensure a repo has imported episodes.
2. Trigger `/api/consolidate` and verify streamed ordering:
   - `consolidation_start`
   - reasoning/response lifecycle events
   - pattern/rule/salience/contradiction events
   - `consolidation_complete`
3. Trigger `/api/distribute` and verify successful ordering:
   - `distribution_start`
   - `pack_rendered`
   - `branch_created`
   - `file_committed`
   - `pr_creating`
   - `pr_created`
   - `distribution_complete`
