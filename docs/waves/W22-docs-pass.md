# Wave 22 Docs Pass (2026-02-08)

## Scope
Unified dashboard assembly for import → consolidation → distribution orchestration.

## Sources checked
- `/Users/frequency/Desktop/dev/codex-demo-worktrees/hippocampus-w21-23/components/onboarding/ConsolidationCTA.tsx`
- `/Users/frequency/Desktop/dev/codex-demo-worktrees/hippocampus-w21-23/components/onboarding/DistributionCTA.tsx`
- `/Users/frequency/Desktop/dev/codex-demo-worktrees/hippocampus-w21-23/components/onboarding/OnboardingFlow.tsx`

## Outcome
- Added `ConsolidationCTA`:
  - run action for sleep cycle initiation
  - inline `DreamStateMini` while streaming
  - completion/error status surfaces.
- Added `DistributionCTA`:
  - distribute action with in-flight phase text
  - success/fallback/error output states
  - markdown preview and copy action.
- Upgraded `OnboardingFlow` from import-only orchestration to unified phase model:
  - `idle -> importing -> ready -> consolidating -> consolidated -> distributing -> distributed -> error`
  - captures `repo_id` from import `complete` event
  - integrates `useConsolidationStream` and `useDistributionStream`.
- Merged feed narratives into one stream:
  - import activity events
  - consolidation activity events
  - live reasoning card pseudo-event
  - distribution progress/result pseudo-events.
- Added debounced graph refresh behavior:
  - debounce 2s on `rule_promoted` / `salience_updated`
  - immediate refresh on `consolidation_complete`.

## Notes
- This wave intentionally keeps backend contracts unchanged and composes existing hooks/events into a single dashboard UX.
