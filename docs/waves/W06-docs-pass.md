# Wave 06 Docs Pass (2026-02-07)

## Scope
Create and populate `mmeigooni/shopflow-platform` with a realistic PR/review corpus for Hippocampus ingestion.

## Repository
- URL: https://github.com/mmeigooni/shopflow-platform
- Visibility: public
- Default branch: `main`

## Corpus summary
- Total merged PRs: 18
- High-salience set (episodes 1-7): PRs #1-#7
- Medium/low-salience set (episodes 8-18): PRs #8-#18
- Contradiction pair: PR #1 (broad retry posture) vs PR #18 (no retry on 4xx declines)
- Review depth: 2 review entries per PR plus author follow-up comment.

## PR index
| Episode | Salience | PR | Title | URL |
|---|---:|---:|---|---|
| 1 | 9 | 1 | payments: prevent blind recursive retries in capture flow | https://github.com/mmeigooni/shopflow-platform/pull/1 |
| 2 | 9 | 2 | checkout: redact cardholder fields from structured logs | https://github.com/mmeigooni/shopflow-platform/pull/2 |
| 3 | 10 | 3 | auth: stop forwarding upstream bearer tokens into downstream headers | https://github.com/mmeigooni/shopflow-platform/pull/3 |
| 4 | 9 | 4 | orders: serialize checkout completion per order id | https://github.com/mmeigooni/shopflow-platform/pull/4 |
| 5 | 10 | 5 | catalog: parameterize product search query construction | https://github.com/mmeigooni/shopflow-platform/pull/5 |
| 6 | 8 | 6 | checkout: validate payment returnUrl host allowlist | https://github.com/mmeigooni/shopflow-platform/pull/6 |
| 7 | 8 | 7 | payments: bound in-memory gateway response cache | https://github.com/mmeigooni/shopflow-platform/pull/7 |
| 8 | 6 | 8 | orders: batch line-item lookups for order listing | https://github.com/mmeigooni/shopflow-platform/pull/8 |
| 9 | 6 | 9 | catalog: enforce cursor pagination on search endpoint | https://github.com/mmeigooni/shopflow-platform/pull/9 |
| 10 | 7 | 10 | payments: remove hardcoded webhook signing secret | https://github.com/mmeigooni/shopflow-platform/pull/10 |
| 11 | 6 | 11 | checkout: add tenant-scoped rate limiting to coupon validation | https://github.com/mmeigooni/shopflow-platform/pull/11 |
| 12 | 6 | 12 | orders: validate order status transitions before writes | https://github.com/mmeigooni/shopflow-platform/pull/12 |
| 13 | 5 | 13 | orders: decouple confirmation email send from request latency | https://github.com/mmeigooni/shopflow-platform/pull/13 |
| 14 | 5 | 14 | catalog: cap analytics query windows for dashboard endpoints | https://github.com/mmeigooni/shopflow-platform/pull/14 |
| 15 | 3 | 15 | catalog: normalize error envelope shape across handlers | https://github.com/mmeigooni/shopflow-platform/pull/15 |
| 16 | 3 | 16 | checkout: tighten response typing for checkout summary | https://github.com/mmeigooni/shopflow-platform/pull/16 |
| 17 | 2 | 17 | payments: remove noisy debug console logging in production path | https://github.com/mmeigooni/shopflow-platform/pull/17 |
| 18 | 7 | 18 | payments: contradiction follow-up on retry policy for 4xx declines | https://github.com/mmeigooni/shopflow-platform/pull/18 |

## Validation notes
- `gh pr list --state merged` returns 18 merged pull requests.
- `gh pr list --json reviews` confirms two review entries per pull request.
- Demo repo target in app env remains `DEMO_REPO=mmeigooni/shopflow-platform`.
