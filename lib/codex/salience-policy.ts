import type { PatternKey } from "@/lib/memory/pattern-taxonomy";

const SALIENCE_MIN = 0;
const SALIENCE_MAX = 10;
const DEFAULT_DEMO_REPO = "mmeigooni/shopflow-platform";

interface SalienceBand {
  min: number;
  max: number;
}

const INITIAL_SALIENCE_BANDS: Record<PatternKey, SalienceBand> = {
  "sensitive-logging": { min: 8, max: 10 },
  "auth-token-handling": { min: 8, max: 10 },
  "concurrency-serialization": { min: 7, max: 9 },
  idempotency: { min: 7, max: 9 },
  "retry-strategy": { min: 6, max: 9 },
  "state-transition": { min: 6, max: 9 },
  "input-validation": { min: 5, max: 8 },
  "dependency-resilience": { min: 5, max: 8 },
  "error-contract": { min: 4, max: 7 },
  "review-hygiene": { min: 1, max: 5 },
};

export const DEMO_SALIENCE_TARGETS_BY_PR: Record<number, number> = {
  1: 9,
  2: 9,
  3: 10,
  4: 9,
  5: 10,
  6: 8,
  7: 8,
  8: 6,
  9: 6,
  10: 7,
  11: 6,
  12: 6,
  13: 5,
  14: 5,
  15: 3,
  16: 3,
  17: 2,
  18: 7,
};

export function clampSalienceScore(score: number) {
  if (!Number.isFinite(score)) {
    return SALIENCE_MIN;
  }

  return Math.max(SALIENCE_MIN, Math.min(SALIENCE_MAX, Math.round(score)));
}

export function isConfiguredDemoRepo(fullName: string) {
  const configuredDemoRepo = (process.env.DEMO_REPO ?? DEFAULT_DEMO_REPO).trim().toLowerCase();
  return fullName.trim().toLowerCase() === configuredDemoRepo;
}

export function calibrateInitialSalience({ rawScore, patternKey }: { rawScore: number; patternKey: PatternKey }) {
  const score = clampSalienceScore(rawScore);
  const band = INITIAL_SALIENCE_BANDS[patternKey];

  return clampSalienceScore(Math.max(band.min, Math.min(band.max, score)));
}

export function boundConsolidationDelta({
  currentScore,
  proposedScore,
  maxDelta = 3,
}: {
  currentScore: number;
  proposedScore: number;
  maxDelta?: number;
}) {
  const current = clampSalienceScore(currentScore);
  const proposed = clampSalienceScore(proposedScore);
  const delta = proposed - current;

  if (Math.abs(delta) <= maxDelta) {
    return proposed;
  }

  return clampSalienceScore(current + Math.sign(delta) * maxDelta);
}
