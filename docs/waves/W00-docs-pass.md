# Wave 00 Docs Pass (2026-02-07)

## Purpose
Bootstrap source-of-truth versions and official documentation links before implementation.

## Library Baseline

| Library | Version | Primary docs |
|---|---:|---|
| `@openai/codex-sdk` | `0.98.0` | https://raw.githubusercontent.com/openai/codex/main/sdk/typescript/README.md |
| `@ast-grep/napi` | `0.40.5` | https://ast-grep.github.io/guide/api-usage.html |
| `next` | `16.1.6` | https://nextjs.org/docs |
| `tailwindcss` | `4.1.18` | https://tailwindcss.com/docs/installation/framework-guides/nextjs |
| `@supabase/supabase-js` | `2.95.3` | https://supabase.com/docs/reference/javascript/introduction |
| `@supabase/ssr` | `0.8.0` | https://supabase.com/docs/guides/auth/server-side/nextjs |
| `@react-three/fiber` | `9.5.0` | https://docs.pmnd.rs/react-three-fiber |
| `@react-three/drei` | `10.7.7` | https://docs.pmnd.rs/drei/introduction |
| `@react-three/postprocessing` | `3.0.4` | https://github.com/pmndrs/react-postprocessing |
| `motion` / `framer-motion` | `12.33.0` | https://motion.dev/docs/react |
| `octokit` | `5.0.5` | https://github.com/octokit/octokit.js |
| `vitest` | `4.0.18` | https://vitest.dev/ |

## Notes
- Run a per-wave docs pass and capture the resulting versions and links in `docs/waves/`.
- If a version drift is detected, update implementation notes and call out migrations before coding.
