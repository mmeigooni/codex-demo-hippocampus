# Wave 18 Docs Pass (2026-02-08)

## Scope
Streaming foundation primitives for consolidation/distribution events and streamed schema-constrained Codex runs.

## Sources checked
- `lib/codex/types.ts`
- `lib/codex/client.ts`
- `tests/client-streamed.test.ts`
- `lib/github/types.ts`
- `app/api/github/import/route.ts`

## Outcome
- Extended consolidation SSE event union with streaming lifecycle events:
  - `reasoning_start`, `reasoning_delta`, `reasoning_complete`, `response_start`, `response_delta`.
- Extended distribution SSE event union with granular PR progress events:
  - `branch_created`, `file_committed`, `pr_creating`.
- Added `ReasoningDeltaData` contract with cumulative reasoning text semantics.
- Added `runStreamedWithSchema<T>()` and `StreamedRunCallbacks`:
  - consumes `thread.runStreamed(..., { outputSchema })`
  - emits reasoning/response lifecycle callbacks
  - preserves `Promise<T>` return contract via final JSON parse.
- Preserved existing `runWithSchema<T>()` path unchanged.
- Added import bridge on complete event:
  - `complete.data.repo_id` now emitted from `/api/github/import`.

## Notes
- Streaming callback payloads include item IDs so route/consolidator layers can choose whether to expose IDs or strip them.
- Empty/non-JSON streamed terminal responses raise the same error semantics used by `runWithSchema`.
