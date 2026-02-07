# WP-002 Spike: ast-grep Node.js Integration

## Objective
Verify `@ast-grep/napi` is usable from Node.js for structural extraction from PR diff context.

## Findings
- Package/version: `@ast-grep/napi@0.40.5`.
- Official docs provide a JavaScript API path for programmatic matching.
- Structural matching is language-aware and better than regex for semantically relevant extraction.

## Recommended integration shape
1. Normalize selected diff hunks into language-specific code snippets.
2. Run ast-grep rules generated from review comments/context.
3. Return compact snippets for encoder prompt input.

## String vs file strategy
- Primary: in-memory snippet matching via NAPI API.
- Fallback: write snippet to temp file and run ast-grep matching against the file.

## Go/No-Go
- **Go**: integration is viable and aligned with token-optimization goals.

## Risk note
- Mixed-language diffs require per-file language routing and graceful no-match handling.
