# Wave 19 Docs Pass (2026-02-08)

## Scope
Route-level streaming integration for consolidation and distribution, including throttled reasoning deltas and granular distribution progress signals.

## Sources checked
- `lib/codex/consolidator.ts`
- `tests/consolidator.test.ts`
- `app/api/consolidate/route.ts`
- `lib/distribution/create-pack-pr.ts`
- `tests/create-pack-pr.test.ts`
- `app/api/distribute/route.ts`
- `tests/distribution-route-fallback.test.ts`

## Outcome
- `consolidateEpisodes()` now supports optional `ConsolidationStreamCallbacks` and conditionally uses `runStreamedWithSchema` while preserving the existing `runWithSchema` path.
- Consolidation SSE route now emits streamed lifecycle events before pattern/rule processing:
  - `reasoning_start`
  - throttled `reasoning_delta` (200ms, cumulative text)
  - `reasoning_complete`
  - `response_start`
  - `response_delta` (with `partial_length`)
- Added local throttling helper in `/api/consolidate` to avoid per-token SSE flooding and flush pending deltas on completion/error.
- `createPackPR()` now accepts progress callbacks for branch creation, file commit, and PR creation phases.
- Distribution SSE route now emits:
  - `branch_created`
  - `file_committed`
  - `pr_creating`
  between `pack_rendered` and `pr_created`.
- Added focused tests validating callback wiring and distribution progress event sequencing.

## Notes
- Reasoning text remains cumulative to simplify client replacement semantics.
- Existing post-consolidation events (`pattern_detected`, `rule_promoted`, `contradiction_found`, `salience_updated`) remain unchanged.
