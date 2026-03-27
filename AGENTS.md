# Hippocampus Agent Guide

## Project overview
Hippocampus is a shared memory layer for Codex teams. It ingests pull requests, encodes incidents into episodes, visualizes collective memory, and runs consolidation to promote durable rules.

## Architecture
- **Frontend**: Next.js App Router + Tailwind v4 + shadcn/ui.
- **Data**: Supabase Postgres (`profiles`, `repos`, `episodes`, `rules`, `index_entries`, `consolidation_runs`).
- **GitHub ingestion**: Octokit-based API routes and SSE import progress.
- **Encoding**: Codex SDK structured output with schema-constrained JSON.
- **Consolidation**: multi-step Codex orchestration for pattern/rule extraction.

## Directory map
- `app/`: App Router pages and API routes.
- `components/`: UI and domain components.
- `lib/`: integrations and domain logic (`supabase`, `github`, `codex`).
- `supabase/migrations/`: SQL schema and migration files.
- `.codex/prompts/`: reusable Codex prompt templates.
- `docs/` (local-only, gitignored): wave docs passes, brainstorms, and research notes.

## Decision highlights
- Hybrid encoder: deterministic metadata + LLM judgment.
- Model tiers: nano for low-complexity generation, mini for encoding, higher-reasoning tier for consolidation.
- Token optimization: ast-grep structural extraction before encoding.
- Streaming: SSE for import and consolidation progress.

## Conventions
- Branches: `codex/wXX-...`
- Commits: `wave-XX(wp-YYY): ...`
- PRs: `[Wave XX] ...` with `Context`, `Docs Checked`, `Changes`, `Validation`, `Risks`.
- Merge strategy: merge commits only.
- Secrets: `.env.local` only; never commit real credentials.

## Implementation guardrails
- Keep route handlers in `app/api/**/route.ts`.
- Keep server-only integration code in `lib/*`.
- Validate Codex outputs with explicit JSON schemas.
- Preserve deterministic field extraction outside of LLM calls.
