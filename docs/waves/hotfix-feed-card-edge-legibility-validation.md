# Hotfix Validation: Feed Card Edge Legibility (2026-02-09)

## Scope
Improve idle left-edge visibility and hover clarity for dashboard neural feed cards (`ActivityCard`, `PRGroupCard`, `RuleGroupCard`) without changing interaction semantics.

## Behavior changes
- Feed rail wrapper now uses symmetric micro-gutters (`px-1`) and feed stack inner gutter (`px-0.5`) to prevent left-border blending with the scroll edge.
- `ActivityCard` baseline border moved from `border-zinc-800` to `border-zinc-700/80`.
- `ActivityCard` hover now uses stronger border contrast (`hover:border-cyan-300/55`) plus subtle background lift (`hover:bg-zinc-900/85`).
- `PRGroupCard` baseline border and nested episode card borders now use brighter neutral defaults with stronger hover treatment.
- `RuleGroupCard` baseline border now starts at muted cluster border and promotes to full cluster border on hover (when selectable and not selected).
- Selected and pinned semantics are preserved (`ring`/accent + `border-l-4` remain strongest).

## Automated validation
- `npm run lint` ❌
  - Fails due existing repo-wide lint errors outside this hotfix scope:
    - `components/brain/BrainGraph.tsx:127` (`react-hooks/set-state-in-effect`)
    - `components/brain/NeuralEdge.tsx:33` (`react-hooks/set-state-in-effect`)
    - `components/feed/PRGroupCard.tsx:88` (`react-hooks/set-state-in-effect`, pre-existing pattern)
    - `hooks/useTheatricalScheduler.ts:272` (`react-hooks/refs`)
- `npm run test` ✅
  - 24 test files passed, 90 tests passed.

## Chrome DevTools visual audit evidence
- Dashboard route: `http://localhost:3000/dashboard`
- Reproduced import flow to populate feed cards and inspected computed styles.
- Idle `ActivityCard` probe:
  - `borderColor: oklab(0.369999 0.00353649 -0.0124992 / 0.8)`
  - `borderLeftWidth: 1px`
- Hovered `ActivityCard` probe:
  - `borderColor: oklab(0.864993 -0.113081 -0.0577893 / 0.55)`
  - `backgroundColor: oklab(0.209999 0.00163988 -0.0057656 / 0.85)`
  - confirms stronger hover edge and background emphasis over idle
- Captured viewport screenshots for regression evidence:
  - `/tmp/w30-hotfix-branch-100.png` (100% zoom)
  - `/tmp/w30-hotfix-branch-hover.png` (hover state)
  - `/tmp/w30-hotfix-branch-125.png` (125% zoom)

## Manual checklist
- Idle left edge is visually readable across feed cards at 100% and 125% zoom.
- Hover state is clearer than idle.
- Selected and graph-pinned states remain visually strongest.
