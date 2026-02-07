# Wave 07 Docs Pass (2026-02-07)

## Scope
Replace placeholder episode imports with schema-constrained Codex encoding plus ast-grep token optimization.

## Sources checked
- Codex SDK README/API: `@openai/codex-sdk@0.98.0`
- ast-grep NAPI API surface: `@ast-grep/napi@0.40.5`
- Existing prompt templates in `.codex/prompts/*`

## Outcome
- Added reusable Codex client helpers (`createCodexThread`, `runWithSchema`).
- Added ast-grep-based search rule generation and snippet extraction with deterministic fallback.
- Added hybrid encoder that keeps deterministic metadata extraction outside LLM calls.
- Wired `/api/github/import` to fetch reviews + diff, run search optimization, encode episodes, and stream enriched SSE payloads.
- Added server external package config for `@ast-grep/napi` in Next.js route runtime.
