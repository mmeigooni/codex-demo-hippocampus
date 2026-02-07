# Wave 01 Integration Spike Brainstorm

## What we are building
A validated integration foundation for three critical subsystems:
1. Codex SDK structured + streamed inference.
2. ast-grep structural extraction for token reduction.
3. 3D graph stack for brain visualization with glow and interaction.

## Why this approach
The first build risk is integration uncertainty, not feature coding. Running focused spikes early minimizes rework in the implementation waves.

## Approaches considered
1. Full prototype app first.
- Pros: immediate visual progress.
- Cons: hides integration unknowns until late.

2. Read-only spike docs per subsystem.
- Pros: fastest risk reduction, clear go/no-go signals.
- Cons: no shipping features yet.

3. Mock-only assumptions.
- Pros: fastest start.
- Cons: high risk of dead ends in later waves.

## Recommended approach
Approach 2. Ship evidence-backed spike documents before writing feature code.

## Decisions
- Use Codex SDK `thread.run(..., { outputSchema })` for constrained outputs.
- Use Codex SDK `thread.runStreamed()` for progress events.
- Use `@ast-grep/napi` first; fallback to temp-file strategy if direct diff-string parsing is insufficient.
- Use `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing` for brain rendering.

## Exit criteria
- Each spike has a documented recommendation, fallback, and implementation note.
