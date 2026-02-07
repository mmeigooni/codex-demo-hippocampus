# WP-003 Spike: React Three Fiber Force Graph + Bloom

## Objective
Verify R3F stack compatibility for a glowing interactive graph scene.

## Findings
- Packages validated for use together:
  - `@react-three/fiber@9.5.0`
  - `@react-three/drei@10.7.7`
  - `@react-three/postprocessing@3.0.4`
- `Canvas` supports pointer events and performance tuning.
- `OrbitControls` is standard from Drei.
- Bloom in react-postprocessing supports selective glow via emissive intensity and non-tone-mapped materials.

## Recommended rendering stack
- Scene: `Canvas` + `OrbitControls` + ambient/point lights.
- Atmosphere: `Sparkles` from Drei.
- Glow: `EffectComposer` + `Bloom`.
- Nodes: emissive materials (`toneMapped={false}` where needed for stronger bloom response).

## Force layout decision
- Keep abstraction in `BrainGraph` so force solver can be swapped.
- Start with a pure JS force solver integration and maintain node/edge adapter boundaries.

## Go/No-Go
- **Go**: stack is compatible and production-viable for this project scope.

## Fallback
- If force graph package coupling is brittle, run layout in app state (d3-force-3d style) and render with R3F primitives.
