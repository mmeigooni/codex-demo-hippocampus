# Wave 04 Docs Pass (2026-02-07)

## Scope
GitHub OAuth + authenticated application shell.

## Sources checked
- Supabase Auth for Next.js App Router: https://supabase.com/docs/guides/auth/server-side/nextjs
- Next.js file conventions (`proxy.ts` in v16): https://nextjs.org/docs/app/api-reference/file-conventions
- Next.js authentication guide: https://nextjs.org/docs/app/guides/authentication

## Outcome
- OAuth callback endpoint implemented.
- Session guard implemented via `proxy.ts` + Supabase middleware helper.
- Login and dashboard shell are in place for authenticated flow.
