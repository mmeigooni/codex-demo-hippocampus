# Wave 10 Next.js Best-Practices Review

## Checks
- Consolidation external I/O and persistence live in route handler (`app/api/consolidate/route.ts`), not client components.
- Sleep-cycle page remains a server component that performs authenticated data bootstrapping and delegates interactive logic to client components.
- Dream-state/SSE parsing logic remains in client-only components.
- No browser-only APIs introduced in server route handlers.

## Outcome
No blocking Next.js best-practice violations identified for Wave 10 scope.
