import { PATTERN_SUPER_CATEGORY, type PatternKey, type SuperCategory } from "@/lib/memory/pattern-taxonomy";

export interface ColorFamily {
  bg: string;
  bgMuted: string;
  border: string;
  borderMuted: string;
  text: string;
  textMuted: string;
  accent: string;
  accentMuted: string;
  glow: string;
}

export const CLUSTER_PALETTE: readonly ColorFamily[] = [
  {
    bg: "#0c4a6e",
    bgMuted: "#082f49",
    border: "#22d3ee",
    borderMuted: "#0891b2",
    text: "#cffafe",
    textMuted: "#a5f3fc",
    accent: "#67e8f9",
    accentMuted: "#06b6d4",
    glow: "rgba(34, 211, 238, 0.42)",
  },
  {
    bg: "#78350f",
    bgMuted: "#451a03",
    border: "#f59e0b",
    borderMuted: "#d97706",
    text: "#fef3c7",
    textMuted: "#fde68a",
    accent: "#fbbf24",
    accentMuted: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.42)",
  },
  {
    bg: "#881337",
    bgMuted: "#4c0519",
    border: "#fb7185",
    borderMuted: "#e11d48",
    text: "#ffe4e6",
    textMuted: "#fecdd3",
    accent: "#fda4af",
    accentMuted: "#fb7185",
    glow: "rgba(251, 113, 133, 0.42)",
  },
  {
    bg: "#4c1d95",
    bgMuted: "#2e1065",
    border: "#a78bfa",
    borderMuted: "#8b5cf6",
    text: "#ede9fe",
    textMuted: "#ddd6fe",
    accent: "#c4b5fd",
    accentMuted: "#a78bfa",
    glow: "rgba(167, 139, 250, 0.42)",
  },
] as const;

const SUPER_CATEGORY_COLOR_INDEX: Record<SuperCategory, number> = {
  safety: 0,
  resilience: 1,
  security: 2,
  flow: 3,
};

const PATTERN_COLOR_INDEX: Record<PatternKey, number> = Object.fromEntries(
  Object.entries(PATTERN_SUPER_CATEGORY).map(([key, category]) => [
    key,
    SUPER_CATEGORY_COLOR_INDEX[category as SuperCategory],
  ]),
) as Record<PatternKey, number>;

function hashDjb2(input: string): number {
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
  }

  return hash >>> 0;
}

export function getColorFamilyByIndex(index: number): ColorFamily {
  const totalFamilies = CLUSTER_PALETTE.length;
  const normalizedIndex = ((Math.trunc(index) % totalFamilies) + totalFamilies) % totalFamilies;
  return CLUSTER_PALETTE[normalizedIndex]!;
}

export function getColorFamilyForPatternKey(patternKey: PatternKey): ColorFamily {
  const index = PATTERN_COLOR_INDEX[patternKey] ?? PATTERN_COLOR_INDEX["review-hygiene"];
  return getColorFamilyByIndex(index);
}

function getColorFamilyById(id: string): ColorFamily {
  if (!id) {
    return getColorFamilyByIndex(0);
  }

  return getColorFamilyByIndex(hashDjb2(id) % CLUSTER_PALETTE.length);
}

export function getColorFamilyForRule(ruleId: string): ColorFamily {
  return getColorFamilyById(ruleId);
}

export function getColorFamilyForEpisode(episodeId: string): ColorFamily {
  return getColorFamilyById(episodeId);
}
