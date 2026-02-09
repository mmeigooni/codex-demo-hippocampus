# Hippocampus — Wave Build Plan

## Objective

Deliver Wave 29 by propagating deterministic cluster colors across graph and feed surfaces, and by introducing a dedicated rule promotion card so rule events are visually distinct and cross-selection context is preserved.

## Scope

| In scope | Out of scope |
| -------- | ------------ |
| Cluster colors on EpisodeNode and RuleNode (3D graph) | Magnetic regrouping with shared `layoutId` transitions |
| Cluster-colored NeuralEdge based on source node | Cluster color changes to `ReasoningCard` or `DreamStateMini` |
| Cluster accents on `ActivityCard`, `PRGroupCard`, `TriggerPill` | New API fields or data model changes |
| New `RuleGroupCard` for `rule_promoted` events | Inline episode expansion inside `RuleGroupCard` |
| Render `RuleGroupCard` in `NeuralActivityFeed` | Onboarding flow or consolidation pipeline redesign |

## Decision Log

| Decision | Choice | Rationale | Affects |
| -------- | ------ | --------- | ------- |
| Issue number baseline | Start at `WP-094` | Confirmed latest merged completion tag is `wp-093-done` on `main` | WP-094, WP-095, WP-096, WP-097 |
| Color derivation strategy | Derive inside each component using node identity | Avoid prop threading and keep components independently color-resolvable | WP-094, WP-095, WP-096 |
| Consolidation color handling | Keep semantic event variants unless `graphNodeId` is present, then add cluster tint | Preserve existing event language while adding graph-feed association | WP-095 |
| Edge coloring source | Use source node cluster family | Relationship ownership reads from origin node | WP-094 |
| Rule card scope | Ship static `RuleGroupCard` with rule metadata and cluster color accents | Provides value without requiring additional data threading | WP-096, WP-097 |
| Rule promotion fallback path | If `rule_promoted` lacks valid `rule_id`/`graphNodeId`, render `ActivityCard` via existing fallback branch | Keeps feed resilient with no event loss and no extra placeholder path | WP-097 |
| TriggerPill strategy | Optional `accentColor` with default zinc fallback | Backward-compatible extension for cluster-aware styling | WP-095, WP-096 |

## Pre-Execution Feedback Checkpoint

Before executing any issue, run `request_user_feedback` with this plan and capture one of:

- Proceed with plan unchanged
- Proceed with edits to scope or sequencing
- Pause for additional design exploration

No implementation starts until this checkpoint returns explicit proceed confirmation.

---

## Wave 29 — Cluster Color Propagation and Rule Cards

> Apply deterministic cluster palette mapping to graph nodes/edges and feed cards, then introduce a dedicated rule promotion card in the feed.

### Required Skills (Wave 29)

- `vercel-react-best-practices` — component structure, prop contracts, and render stability
- `threejs-animation` — safe material color updates for R3F graph primitives
- `framer-motion` — spring-based entry behavior for the new rule card

### WP-094: Apply cluster colors to graph nodes and edges

- **Priority:** P1
- **Dependencies:** none
- **Files:** `components/brain/EpisodeNode.tsx`, `components/brain/RuleNode.tsx`, `components/brain/NeuralEdge.tsx`, `components/brain/BrainGraph.tsx`
- **Required Skills:**
  - `threejs-animation` (mesh material color wiring)
- **Review Agents:**
  - `kieran-typescript-reviewer` (timing: pre-merge)
- **Objective:** Episode/rule nodes and connecting edges derive colors from the cluster palette instead of hardcoded cyan/amber values.
- **Implementation notes:**
  - Add `nodeId: string` to `EpisodeNode` and `RuleNode` props.
  - Use `getColorFamilyForEpisode(nodeId)` and `getColorFamilyForRule(nodeId)` in component scope.
  - Replace only color hex usage in main mesh and rim glow materials.
  - Extend `NeuralEdge` with optional `color?: string`; preserve existing cyan default when omitted.
  - In `BrainGraph`, compute edge color from source node type/family and pass into `NeuralEdge`.
  - Do not alter force layout, spawn animation timing, or selection behavior logic.
- **Acceptance criteria:**
  - [ ] Episode nodes render with cluster-derived colors
  - [ ] Rule nodes render with cluster-derived colors
  - [ ] Edges derive color from source node cluster family
  - [ ] Selected nodes still brighten correctly
  - [ ] `npx tsc --noEmit` passes
- **Evidence:** Typecheck output and visual confirmation of multi-family graph colors.

### WP-095: Apply cluster colors to feed cards and trigger pills

- **Priority:** P1
- **Dependencies:** none
- **Files:** `components/feed/ActivityCard.tsx`, `components/feed/PRGroupCard.tsx`, `components/feed/TriggerPill.tsx`
- **Required Skills:**
  - `vercel-react-best-practices` (conditional styling without regressions)
- **Review Agents:**
  - `kieran-typescript-reviewer` (timing: pre-merge)
- **Objective:** Feed cards with `graphNodeId` get cluster-matched accents while events without node mapping retain current semantic colors.
- **Implementation notes:**
  - In `ActivityCard`, derive optional `clusterColor` from `graphNodeId` using rule/episode family lookup.
  - Apply dynamic border, label, selected ring, and pinned-left accent styles when `clusterColor` exists.
  - Keep fallback variant classes for non-node-linked events.
  - In `PRGroupCard`, derive color from first episode node and apply matching accents for wrapper, labels, and selected/pinned states.
  - Add optional `accentColor?: string` to `TriggerPill`; apply runtime style when provided and keep existing zinc classes otherwise.
  - Avoid interface changes to `ActivityEventView`.
- **Acceptance criteria:**
  - [ ] Node-linked import cards show cluster-matched accents
  - [ ] Consolidation events without `graphNodeId` preserve prior variants
  - [ ] `PRGroupCard` tint aligns with first episode node family
  - [ ] `TriggerPill` supports optional accent color with backward compatibility
  - [ ] `npx tsc --noEmit` passes
- **Evidence:** Typecheck output and visual comparison of feed card ↔ graph node color parity.

### WP-096: Create RuleGroupCard component

- **Priority:** P1
- **Dependencies:** none
- **Files:** `components/feed/RuleGroupCard.tsx`
- **Required Skills:**
  - `vercel-react-best-practices` (component contract and render clarity)
  - `framer-motion` (spring entry animation)
- **Review Agents:**
  - `kieran-typescript-reviewer` (timing: pre-merge)
- **Objective:** Introduce a dedicated rule promotion card with cluster-derived color styling and rule metadata presentation.
- **Implementation notes:**
  - Create `RuleGroupCardProps` covering title, rule identity, confidence, triggers, episode count, index, selected/pinned state, and selection callback.
  - Use `getColorFamilyForRule(ruleId)` for all cluster-derived accents.
  - Render as `motion.article` with `initial={{ opacity: 0, y: 14 }}` and spring transition (`damping: 20`, `stiffness: 150`).
  - Include top label (`Sparkles` + “Rule Promoted”), title, confidence indicator, triggers via `TriggerPill`, and episode count badge.
  - Keep state styling parity with existing cards (selected ring + pinned left border accent).
- **Acceptance criteria:**
  - [ ] `RuleGroupCard` is exported from `components/feed/RuleGroupCard.tsx`
  - [ ] Card renders rule title, confidence, trigger pills, and episode count
  - [ ] Colors come from rule cluster family
  - [ ] Entry animation uses specified spring config
  - [ ] `npx tsc --noEmit` passes
- **Evidence:** Typecheck output and isolated render screenshot or local UI capture.

### WP-097: Render RuleGroupCard for rule promotion events

- **Priority:** P1
- **Dependencies:** WP-096
- **Files:** `components/feed/NeuralActivityFeed.tsx`
- **Required Skills:**
  - `vercel-react-best-practices` (type narrowing and conditional card rendering)
- **Review Agents:**
  - `kieran-typescript-reviewer` (timing: pre-merge)
- **Objective:** `rule_promoted` feed events render as `RuleGroupCard` while all existing card paths remain behaviorally unchanged.
- **Implementation notes:**
  - Import `RuleGroupCard` into `NeuralActivityFeed`.
  - In event rendering branch, keep grouped episode condition first.
  - Add `rule_promoted` condition before default `ActivityCard` fallback; guard on valid rule linkage and map fields from `event.raw` defensively.
  - Use fallback-only rendering for missing linkage: if `event.type === "rule_promoted"` and `event.graphNodeId` is absent, allow natural fallthrough to `ActivityCard`.
  - Preserve wrapper `ref` behavior for scroll-to-pinned compatibility.
  - Avoid prop/interface or render-window logic changes outside targeted condition.
- **Acceptance criteria:**
  - [ ] `rule_promoted` events render as `RuleGroupCard`
  - [ ] `rule_promoted` events without valid `graphNodeId` fall back to `ActivityCard` (no drop, no placeholder)
  - [ ] Non-rule events continue rendering existing card types
  - [ ] Cross-selection and pinned scroll behavior continue working
  - [ ] `npx tsc --noEmit` passes
- **Evidence:** Typecheck output and consolidation-flow UI verification.

**Wave exit:** `npx tsc --noEmit` passes, full import + consolidation flow verified, no regressions in cross-selection or pinned-feed behavior.

**Wave completion:** All issue PRs merged, wave exit gate passed, wave completion commit/tag created, and local/GitHub sync checkpoint completed.

---

## File Ownership Matrix

| File | Wave | Issue(s) |
| ---- | ---- | -------- |
| `components/brain/EpisodeNode.tsx` | 29 | WP-094 |
| `components/brain/RuleNode.tsx` | 29 | WP-094 |
| `components/brain/NeuralEdge.tsx` | 29 | WP-094 |
| `components/brain/BrainGraph.tsx` | 29 | WP-094 |
| `components/feed/ActivityCard.tsx` | 29 | WP-095 |
| `components/feed/PRGroupCard.tsx` | 29 | WP-095 |
| `components/feed/TriggerPill.tsx` | 29 | WP-095 |
| `components/feed/RuleGroupCard.tsx` | 29 | WP-096 |
| `components/feed/NeuralActivityFeed.tsx` | 29 | WP-097 |

## Parallelism Notes

- Wave 29 parallel block: `WP-094`, `WP-095`, and `WP-096` (no file overlap)
- Wave 29 sequential tail: `WP-097` after `WP-096`

## Assumptions

- `lib/color/cluster-palette.ts` is stable and requires no API change.
- `graphNodeId` format remains consistent across event producers.
- `rule_promoted` events continue exposing `rule_id` and optional metadata in `event.raw`.
- When `rule_promoted` linkage is missing, feed rendering must preserve the event via existing `ActivityCard` fallback.
- `framer-motion` and `lucide-react` are already available in the current app.
- Runtime inline style usage for dynamic palette values is acceptable with Tailwind utility classes.
