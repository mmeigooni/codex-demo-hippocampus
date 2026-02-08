# Wave 17 Docs Pass (2026-02-08)

## Scope
Distribution reliability improvements for GitHub PR creation from Sleep Cycle output.

## Sources checked
- `components/auth/LoginWithGitHubButton.tsx`
- `app/api/distribute/route.ts`
- `components/sleep-cycle/SleepCyclePanel.tsx`
- `lib/distribution/ui-state.ts`

## Outcome
- Updated GitHub OAuth login to request `public_repo` scope for branch + PR writes on public repositories.
- Refined Supabase distribution flow:
  - PR creation failures now emit `distribution_complete` with `skipped_pr: true` and full markdown.
  - Fallback metadata persists as `summary.distribution.status = "completed"` in supabase mode.
  - `distribution_error` is reserved for pre-render/unrecoverable failures (missing run/pack, auth/session issues, persist failures).
- Updated Sleep Cycle fallback UI copy to explicitly instruct manual PR flow with copyable markdown preview.
- Added targeted tests for route fallback behavior and UI fallback messaging.

## Operational note
- Existing signed-in users must log out and log back in once to refresh GitHub provider token scopes.

