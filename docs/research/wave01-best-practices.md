# Wave 01 Best Practices Synthesis

## Codex SDK
- Keep prompt templates versioned under `.codex/prompts/`.
- Enforce JSON schema outputs for machine-consumed steps.
- Stream internal progress events to user-visible SSE endpoints.

## ast-grep
- Prefer structural rules over regex.
- Use per-language matching boundaries and avoid parsing full raw diffs blindly.
- Keep fallback behavior deterministic when no match is found.

## R3F stack
- Keep 3D node components small and composable.
- Isolate graph layout logic from rendering components.
- Profile draw calls and tune bloom for legibility before adding effects.
