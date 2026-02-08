# Wave 18 Handoff Validation (2026-02-08)

## Targeted checks
- Consolidation event type union includes 12 members (7 existing + 5 streaming lifecycle).
- Distribution event type union includes 8 members (5 existing + 3 progress lifecycle).
- `runStreamedWithSchema<T>()` callbacks fire for reasoning/response lifecycle and final JSON output is parsed.
- `runWithSchema<T>()` behavior remains intact.
- Import `complete` event includes `repo_id` for post-import repo selection bridge.

## Validation commands
- `npx tsc --noEmit` ✅
- `npx vitest run tests/client-streamed.test.ts` ✅
- `npm test` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual validation notes
1. Trigger `/api/github/import` in a signed-in session.
2. Verify terminal `complete` SSE payload contains:
   - `total`
   - `failed`
   - `skipped`
   - `repo_id`
3. Confirm no regressions in import event parsing and existing UI flow.
