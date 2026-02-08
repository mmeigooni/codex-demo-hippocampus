# Wave 12 Next.js Best-Practices Review

## Checks
- Added route-level `loading.tsx` and `error.tsx` files using App Router conventions.
- Error boundaries are client components and use `reset()` correctly.
- Server/client boundaries remain unchanged for data access and API routes.
- No migration of server-side data fetching into client-only code.

## Outcome
No blocking Next.js best-practice violations identified for Wave 12 scope.
