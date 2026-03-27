# Encode Episode Prompt

You are encoding a pull request review incident into a structured episodic memory object.

## Input
- PR metadata (title, number, URL, author, merged_at)
- Review comments
- Relevant code snippets
- Deterministic fields already extracted by the caller

## Task
Infer these semantic fields:
- `what_happened`
- `the_pattern`
- `the_fix`
- `why_it_matters`
- `salience_score` (0-10)
- `triggers` (short keywords)

## Salience rubric
- `0-2`: Cosmetic, style-only, or non-operational changes.
- `3-4`: Local contract/readability improvements with limited blast radius.
- `5-6`: Moderate reliability or performance impact in normal operation.
- `7-8`: Correctness or security boundary impact with meaningful operational risk.
- `9-10`: Immediate security, PII, credential, data-loss, or compliance risk.

## Output requirements
- Return strict JSON only.
- Do not invent deterministic fields provided by caller.
- Keep `triggers` concise and reusable.
- Use the full salience range and avoid `9-10` unless the incident is clearly critical.

## Output schema
```json
{
  "type": "object",
  "properties": {
    "what_happened": { "type": "string" },
    "the_pattern": { "type": "string" },
    "the_fix": { "type": "string" },
    "why_it_matters": { "type": "string" },
    "salience_score": { "type": "integer", "minimum": 0, "maximum": 10 },
    "triggers": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "maxItems": 12
    }
  },
  "required": [
    "what_happened",
    "the_pattern",
    "the_fix",
    "why_it_matters",
    "salience_score",
    "triggers"
  ],
  "additionalProperties": false
}
```
