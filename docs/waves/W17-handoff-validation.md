# Wave 17 Handoff Validation (2026-02-08)

## Targeted checks
- GitHub OAuth sign-in requests `public_repo` scope for distribution writes.
- Distribution emits markdown fallback completion when PR creation fails in supabase mode.
- Fallback completion persists in `consolidation_runs.summary.distribution` as `status: "completed"`.
- Sleep Cycle distribution banner clearly communicates manual PR path and keeps markdown copy preview available.

## Validation commands
- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm test` ✅
- `npm run build` ✅

## Manual validation
1. Log out and log back in to refresh GitHub scopes.
2. Run Sleep Cycle to generate a completed consolidation run.
3. Click `Distribute to repo`.
4. Verify one of these event sequences:
   - Success: `distribution_start -> pack_rendered -> pr_created -> distribution_complete`
   - Fallback: `distribution_start -> pack_rendered -> distribution_complete(skipped_pr=true)`
5. Confirm fallback UI shows:
   - amber preview banner
   - copyable markdown panel
   - actionable manual PR guidance

