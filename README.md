# Hippocampus

A shared memory system for engineering teams. Hippocampus ingests your team's merged pull requests, encodes each one into a structured "episode" using the OpenAI Codex SDK, then runs a consolidation cycle that surfaces recurring patterns, promotes team rules, and flags contradictions -- all visualized as an interactive 3D brain graph.

The name comes from the region of the human brain responsible for consolidating short-term memories into long-term knowledge. Codex makes individual developers superhuman, but teams don't have memory. Hippocampus gives them one.

## Quick Start

```bash
cp .env.example .env.local
```

Fill in the environment variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `SUPABASE_SECRET_KEY` | Supabase service role key |
| `OPENAI_API_KEY` | OpenAI API key (Codex SDK access) |
| `DEMO_REPO` | Optional. GitHub `owner/repo` for demo salience calibration |

Run the Supabase migrations (`supabase/migrations/`) against your project, then:

```bash
npm install
npm run dev
```

The app runs on `http://localhost:3000`. Sign in with GitHub OAuth (public repos only), connect a repository, and import PRs.

**Without Supabase:** The app falls back to an in-memory runtime store automatically. All features work, but data doesn't persist across restarts.

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm test` | Run test suite (Vitest) |
| `npm run lint` | Lint with ESLint |

## Architecture

### Codex SDK Integration

Hippocampus uses the OpenAI Codex SDK (`@openai/codex-sdk`) at three integration points, each with a deliberately chosen model tier:

| Tier | Model | Reasoning Effort | Used For |
|------|-------|-------------------|----------|
| `nano` | gpt-5-nano | medium | Search rule generation -- cheapest and fastest |
| `mini` | gpt-5-mini | medium | Episode encoding -- the per-PR workhorse |
| `consolidation` | gpt-5 | high | Sleep cycle synthesis -- full reasoning power |

All Codex calls use **schema-constrained output** (`runStreamedWithSchema` / `runWithSchema`). The output schema prevents the model from hallucinating structure, and streaming callbacks expose reasoning deltas in real time.

Key files: `lib/codex/client.ts`, `lib/codex/encoder.ts`, `lib/codex/consolidator.ts`, `lib/codex/search.ts`

### Context Management: LLM Writes Code to Search

Rather than feeding entire PR diffs to the encoder (context-heavy and expensive), Hippocampus uses a two-step approach:

1. **Codex nano** generates AST-grep search patterns from the PR's review comments
2. Those patterns are executed locally via `@ast-grep/napi` to extract only relevant code snippets

The encoder then receives a small, focused context instead of a full diff. `lib/codex/search.ts` includes a `summarizeTokenReduction` utility that quantifies the savings per call.

### Deterministic Pattern Taxonomy

LLM outputs are probabilistic -- free-form labels drift across runs. Hippocampus solves this with a fixed taxonomy layer (`lib/memory/pattern-taxonomy.ts`):

- **10 pattern keys**: `retry-strategy`, `auth-token-handling`, `sensitive-logging`, `input-validation`, etc.
- **4 super-categories**: safety, resilience, security, flow
- **Deterministic regex scoring**: maps LLM output to stable keys via keyword matching with priority-ordered tie-breaking
- **Rule promotion guardrails**: minimum 2-episode support required; no single-observation rules

The LLM generates rich semantic text. The taxonomy normalizes it to stable IDs before storage. This gives repeatability, safe upserts, and trustworthy cross-run comparisons.

### Salience Policy

Salience scores (0-10) are not left to the model's discretion:

- **Initial calibration** bands per pattern type (e.g., `sensitive-logging` floors at 8; `review-hygiene` caps at 5)
- **Consolidation delta caps** of +/-3 per cycle, preventing extreme swings
- **Demo repo overrides** for repeatable demo salience via `DEMO_REPO` env var

See `lib/codex/salience-policy.ts`.

### Consolidation and Theatrical Replay

The "Sleep Cycle" consolidation (`/api/consolidate`) loads all episodes and existing rules, then runs Codex with high reasoning effort to:

- Detect recurring patterns across episodes
- Promote rules (with minimum support enforcement)
- Flag contradictions between episodes
- Adjust salience scores (within bounded deltas)

The full result -- including extended thinking text -- is cached in a `consolidation_runs.summary` JSONB column. Subsequent requests **replay cached events** through a theatrical scheduler (`hooks/useTheatricalScheduler.ts`) with per-event-type timing intervals. This produces the same visual experience at zero API cost.

### Brain Graph Visualization

The 3D brain graph is built with React Three Fiber (`@react-three/fiber`) and organized around the taxonomy:

- **4 spatial islands** correspond to the super-categories (safety, resilience, security, flow)
- **Node placement** uses a golden-angle (Fibonacci spiral) distribution for natural spacing
- **Episode nodes** are fractured hexagonal prisms with deterministic breathing animation (phase offset derived from a hash of the node ID)
- **Rule nodes** are larger, with derived salience from their source episodes
- **Neural edges** connect episodes to rules, with opacity/thickness proportional to salience
- **Bloom post-processing** with mipmap blur creates the neural glow effect

### Data Persistence

Primary storage is **Supabase PostgreSQL** with three migrations:

- `001_initial_schema.sql` -- profiles, repos, episodes, rules, consolidation_runs, index_entries
- `002_pattern_rule_keys.sql` -- adds `pattern_key` to episodes and `rule_key` to rules with unique index
- `003_episodes_idempotent.sql` -- adds unique constraint on `(repo_id, source_pr_number)` for idempotent imports

When Supabase is unavailable, `lib/fallback/runtime-memory-store.ts` provides an in-memory store with the same interface. The app detects schema availability at request time and routes accordingly.

### Security

- GitHub OAuth operates in **public-only mode** -- broad repo scopes are removed, private imports are blocked server-side with an explicit 403
- Codex threads run with `sandboxMode: "read-only"` and `approvalPolicy: "never"`
- All LLM outputs are validated against strict JSON schemas before storage

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict) |
| 3D Visualization | React Three Fiber, Three.js, postprocessing |
| Database | Supabase (PostgreSQL + Auth) |
| LLM | OpenAI Codex SDK (`@openai/codex-sdk`) |
| Code Search | ast-grep (`@ast-grep/napi`) |
| UI | Radix UI, shadcn, Tailwind CSS 4 |
| Animation | Framer Motion (`motion`) |
| Testing | Vitest 4 |

## Testing

39 test files covering Codex SDK integration, pattern taxonomy determinism, consolidation sanitization, replay detection, salience bounding, runtime memory store operations, API route behavior, and UI state management.

```bash
npm test
```

## GitHub Permissions

- OAuth runs in public-only mode
- The app only lists public repositories
- Private repository imports are blocked server-side
