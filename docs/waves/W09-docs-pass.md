# Wave 09 Docs Pass (2026-02-07)

## Scope
Neural activity feed components, SSE consumer integration, and dashboard state wiring between onboarding, feed, and brain graph.

## Sources checked
- Motion for React docs: https://motion.dev/docs/react
- EventSource/SSE framing and stream parsing patterns
- Existing app SSE event contract from `/api/github/import`

## Outcome
- Added feed component set (`ActivityCard`, `NeuralActivityFeed`, badges/pills/snippets).
- Upgraded onboarding flow to parse SSE robustly and render animated feed cards.
- Added import phase state machine (`idle -> importing -> ready/error`) with monotonic transitions.
- Built brain graph nodes/edges directly from `episode_created` events for synchronized feed+graph updates.
