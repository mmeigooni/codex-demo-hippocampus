# Wave 11 Next.js Best-Practices Review

## Checks
- Episodes data fetch remains in server component (`app/episodes/page.tsx`).
- Interactivity (selection/details) remains in client components only.
- Shared SSE parser utility is framework-agnostic and used by client components.
- Test harness additions do not alter runtime route behavior.

## Outcome
No blocking Next.js best-practice violations identified for Wave 11 scope.
