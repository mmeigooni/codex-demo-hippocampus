# Wave 21 Docs Pass (2026-02-08)

## Scope
Dashboard phase UI primitives and navigation hierarchy updates for the upcoming unified dashboard flow.

## Sources checked
- `/Users/frequency/Desktop/dev/codex-demo-worktrees/hippocampus-w21-23/components/sleep-cycle/DreamState.tsx`
- `/Users/frequency/Desktop/dev/codex-demo-worktrees/hippocampus-w21-23/components/onboarding/DreamStateMini.tsx`
- `/Users/frequency/Desktop/dev/codex-demo-worktrees/hippocampus-w21-23/components/layout/Sidebar.tsx`

## Outcome
- Finalized DreamState reasoning label for phase parity with dashboard presentation (`Deep Thinking`).
- Added `DreamStateMini` compact component with:
  - animated phase badge
  - inline counters for patterns/rules/salience/conflicts
  - compact height and muted dashboard-compatible styling.
- Updated sidebar structure:
  - primary links remain `Dashboard` and `Episodes`
  - new `Advanced` section contains `Sleep Cycle`
  - Sleep link remains routable to `/sleep-cycle` with de-emphasized styling.

## Notes
- This wave intentionally isolates visual/navigation primitives so Wave 22 can wire orchestration logic without reworking base UI contracts.
