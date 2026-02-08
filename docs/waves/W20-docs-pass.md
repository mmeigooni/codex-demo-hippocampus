# Wave 20 Docs Pass (2026-02-08)

## Scope
Client-side stream abstraction and feed component upgrades, with Sleep Cycle adoption of reusable consolidation/distribution stream hooks.

## Sources checked
- `hooks/useConsolidationStream.ts`
- `hooks/useDistributionStream.ts`
- `components/feed/ReasoningCard.tsx`
- `components/feed/ActivityCard.tsx`
- `components/sleep-cycle/SleepCyclePanel.tsx`
- `components/sleep-cycle/DreamState.tsx`

## Outcome
- Added reusable consolidation SSE hook (`useConsolidationStream`) with:
  - phase, events, progress, storage mode, summary, running/error state
  - streamed reasoning state (`reasoningText`, `isReasoningActive`)
  - reasoning-aware phase transitions.
- Added reusable distribution SSE hook (`useDistributionStream`) with:
  - distribution lifecycle phase text
  - completion/error result handling
  - markdown copy helper state.
- Added `ReasoningCard` feed component:
  - motion entrance aligned to feed animation pattern
  - active pulsing indicator
  - auto-scrolling text container
  - compact completion summary when stream ends.
- Extended `ActivityCard` with variant system and reasoning delegation path.
- Refactored `SleepCyclePanel` to consume stream hooks and render live reasoning output via `ReasoningCard`.
- Extended `DreamState` with `reasoning` phase for streamed model reasoning visibility.

## Notes
- Stream hooks keep SSE parsing concerns isolated from page/panel components.
- Distribution phase text now maps directly from server-emitted progress event types.
