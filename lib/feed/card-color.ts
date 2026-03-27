import {
  getColorFamilyForPatternKey,
  getColorFamilyForEpisode,
  getColorFamilyForRule,
  type ColorFamily,
} from "@/lib/color/cluster-palette";
import { PATTERN_KEYS, type PatternKey } from "@/lib/memory/pattern-taxonomy";

export type { ColorFamily };

export function normalizePatternKey(value: unknown): PatternKey | null {
  if (typeof value !== "string") {
    return null;
  }

  if (!PATTERN_KEYS.includes(value as PatternKey)) {
    return null;
  }

  return value as PatternKey;
}

export function resolvePatternKeyFromRaw(raw: Record<string, unknown>): PatternKey | null {
  const episode = raw.episode;
  if (episode && typeof episode === "object") {
    const nestedPatternKey = normalizePatternKey((episode as Record<string, unknown>).pattern_key);
    if (nestedPatternKey) {
      return nestedPatternKey;
    }
  }

  const topLevelPatternKey = normalizePatternKey(raw.pattern_key);
  if (topLevelPatternKey) {
    return topLevelPatternKey;
  }

  return normalizePatternKey(raw.rule_key);
}

export function resolveClusterColor(graphNodeId: string, raw: Record<string, unknown>): ColorFamily {
  const patternKey = resolvePatternKeyFromRaw(raw);
  if (patternKey) {
    return getColorFamilyForPatternKey(patternKey);
  }

  return graphNodeId.startsWith("rule-") ? getColorFamilyForRule(graphNodeId) : getColorFamilyForEpisode(graphNodeId);
}
