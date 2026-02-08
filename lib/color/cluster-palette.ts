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
  {
    bg: "#14532d",
    bgMuted: "#052e16",
    border: "#4ade80",
    borderMuted: "#22c55e",
    text: "#dcfce7",
    textMuted: "#bbf7d0",
    accent: "#86efac",
    accentMuted: "#4ade80",
    glow: "rgba(74, 222, 128, 0.42)",
  },
  {
    bg: "#0c4a6e",
    bgMuted: "#082f49",
    border: "#38bdf8",
    borderMuted: "#0ea5e9",
    text: "#e0f2fe",
    textMuted: "#bae6fd",
    accent: "#7dd3fc",
    accentMuted: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.42)",
  },
  {
    bg: "#701a75",
    bgMuted: "#4a044e",
    border: "#e879f9",
    borderMuted: "#d946ef",
    text: "#fce7f3",
    textMuted: "#fbcfe8",
    accent: "#f5d0fe",
    accentMuted: "#e879f9",
    glow: "rgba(232, 121, 249, 0.42)",
  },
  {
    bg: "#3f6212",
    bgMuted: "#1a2e05",
    border: "#a3e635",
    borderMuted: "#84cc16",
    text: "#ecfccb",
    textMuted: "#d9f99d",
    accent: "#bef264",
    accentMuted: "#a3e635",
    glow: "rgba(163, 230, 53, 0.42)",
  },
  {
    bg: "#7c2d12",
    bgMuted: "#431407",
    border: "#fb923c",
    borderMuted: "#f97316",
    text: "#ffedd5",
    textMuted: "#fed7aa",
    accent: "#fdba74",
    accentMuted: "#fb923c",
    glow: "rgba(251, 146, 60, 0.42)",
  },
  {
    bg: "#134e4a",
    bgMuted: "#042f2e",
    border: "#2dd4bf",
    borderMuted: "#14b8a6",
    text: "#ccfbf1",
    textMuted: "#99f6e4",
    accent: "#5eead4",
    accentMuted: "#2dd4bf",
    glow: "rgba(45, 212, 191, 0.42)",
  },
] as const;

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
