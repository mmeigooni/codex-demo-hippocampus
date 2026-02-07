# Wave 08 Next.js Best-Practices Review

## Checks
- 3D rendering logic remains in client components under `components/brain/*`.
- Server `app/dashboard/page.tsx` only composes client components and env configuration.
- No browser-only APIs introduced in server route handlers or layout files.

## Outcome
No blocking Next.js best-practice violations identified for Wave 08 scope.
