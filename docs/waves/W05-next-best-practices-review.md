# Wave 05 Next.js Best-Practices Review

## Checks
- Route handlers are kept in `app/api/**/route.ts`.
- Server-only GitHub and Supabase interactions stay out of client components.
- SSE stream route returns proper `text/event-stream` response headers.
- Client onboarding flow contains browser-only logic and fetch handling.

## Outcome
No blocking Next.js best-practice violations identified for Wave 05 scope.
