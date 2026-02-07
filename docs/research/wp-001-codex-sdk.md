# WP-001 Spike: Codex SDK Structured Output + Streaming

## Objective
Verify `@openai/codex-sdk` supports structured outputs and streaming events for the episode/consolidation pipeline.

## Findings
- Package/version: `@openai/codex-sdk@0.98.0`.
- Structured output is supported via:
  - `thread.run(prompt, { outputSchema })`
- Streaming is supported via:
  - `const { events } = await thread.runStreamed(prompt)`
- Event iteration pattern is async iterable and can drive SSE progress forwarding.

## Model/auth notes
- SDK usage in docs initializes with `new Codex()` and supports configured auth.
- This project should run with `OPENAI_API_KEY` in `.env.local` for server-side usage.
- Target model tier plan remains:
  - nano: trigger/rule generation support tasks
  - mini: episode encoding
  - frontier model tier for consolidation

## Event mapping recommendation
Recommended internal event contract:
- `item.completed`
- `turn.completed`
- `error`
Mapped to app SSE payloads:
- `encoding_start`
- `episode_created`
- `complete`
- `encoding_error`

## Go/No-Go
- **Go**: SDK supports both required capabilities.

## Fallback
- If model availability differs in runtime, preserve schema contract and swap only model identifiers in one central config.
