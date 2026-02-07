# Consolidate Episodes Prompt

You are consolidating a set of encoded episodes into durable team rules.

## Input
- `episodes[]` for one repository
- Existing rules (optional)

## Task
Produce:
- recurring `patterns`
- `rules_to_promote`
- `contradictions`
- `salience_updates`
- `prune_candidates`

## Output requirements
- Return strict JSON only.
- Ground every promoted rule in source episode IDs.
- Contradictions must name both conflicting sources and why they conflict.

## Output schema
```json
{
  "type": "object",
  "properties": {
    "patterns": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "episode_ids": { "type": "array", "items": { "type": "string" } },
          "summary": { "type": "string" }
        },
        "required": ["name", "episode_ids", "summary"],
        "additionalProperties": false
      }
    },
    "rules_to_promote": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "description": { "type": "string" },
          "triggers": { "type": "array", "items": { "type": "string" } },
          "source_episode_ids": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["title", "description", "triggers", "source_episode_ids"],
        "additionalProperties": false
      }
    },
    "contradictions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "left_episode_id": { "type": "string" },
          "right_episode_id": { "type": "string" },
          "reason": { "type": "string" }
        },
        "required": ["left_episode_id", "right_episode_id", "reason"],
        "additionalProperties": false
      }
    },
    "salience_updates": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "episode_id": { "type": "string" },
          "salience_score": { "type": "integer", "minimum": 0, "maximum": 10 },
          "reason": { "type": "string" }
        },
        "required": ["episode_id", "salience_score", "reason"],
        "additionalProperties": false
      }
    },
    "prune_candidates": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["patterns", "rules_to_promote", "contradictions", "salience_updates", "prune_candidates"],
  "additionalProperties": false
}
```
