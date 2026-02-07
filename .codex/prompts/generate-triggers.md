# Generate Trigger Rules Prompt

You generate compact trigger terms and structural search hints from review comments.

## Input
- Review comment text
- PR metadata

## Task
Return:
- `triggers`: concise reusable keywords
- `search_rules`: candidate ast-grep patterns

## Output requirements
- Return strict JSON.
- Prefer high-signal terms over long phrases.
- Search rules must be language-aware where possible.

## Output schema
```json
{
  "type": "object",
  "properties": {
    "triggers": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "maxItems": 12
    },
    "search_rules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "language": { "type": "string" },
          "rule": { "type": "string" },
          "intent": { "type": "string" }
        },
        "required": ["language", "rule", "intent"],
        "additionalProperties": false
      }
    }
  },
  "required": ["triggers", "search_rules"],
  "additionalProperties": false
}
```
