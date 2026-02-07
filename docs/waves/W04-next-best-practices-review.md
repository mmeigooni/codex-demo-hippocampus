# Wave 04 Next.js Best-Practices Review

Skill source: /Users/frequency/.agents/skills/next-best-practices/SKILL.md

## Checks
- File convention: used `proxy.ts` and `proxyConfig` for Next.js v16.
- RSC boundaries: client-only OAuth/login/logout logic isolated to client components.
- Metadata and layout: metadata remains in root server layout.
- Route handlers: callback route placed under `app/api/auth/callback/route.ts`.

## Outcome
No blocking Next.js best-practice violations found in Wave 04 scope.
