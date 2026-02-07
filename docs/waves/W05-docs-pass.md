# Wave 05 Docs Pass (2026-02-07)

## Scope
GitHub API connection, repo selection, and SSE-based import pipeline.

## Sources checked
- Octokit docs: https://github.com/octokit/octokit.js
- GitHub REST pulls/reviews APIs: https://docs.github.com/en/rest/pulls
- Next.js route handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- SSE response patterns in App Router route handlers.

## Outcome
- Typed GitHub client added for repos, merged PRs, reviews, and diffs.
- `/api/github/repos` implemented for authenticated repository listing.
- `/api/github/import` implemented with progress stream and placeholder episode creation.
- Onboarding flow wired into dashboard with demo repo quick path and user repo selector.
