export const PATTERN_KEYS = [
  "review-hygiene",
  "sensitive-logging",
  "auth-token-handling",
  "error-contract",
  "concurrency-serialization",
  "idempotency",
  "retry-strategy",
  "input-validation",
  "state-transition",
  "dependency-resilience",
] as const;

export type PatternKey = (typeof PATTERN_KEYS)[number];

const PATTERN_PRIORITY: PatternKey[] = [
  "sensitive-logging",
  "auth-token-handling",
  "error-contract",
  "concurrency-serialization",
  "idempotency",
  "retry-strategy",
  "input-validation",
  "state-transition",
  "dependency-resilience",
  "review-hygiene",
];

export const PATTERN_LABELS: Record<PatternKey, string> = {
  "review-hygiene": "Review hygiene",
  "sensitive-logging": "Sensitive logging",
  "auth-token-handling": "Auth token handling",
  "error-contract": "Error contract consistency",
  "concurrency-serialization": "Concurrency serialization",
  idempotency: "Idempotency enforcement",
  "retry-strategy": "Retry strategy",
  "input-validation": "Input validation",
  "state-transition": "State transition integrity",
  "dependency-resilience": "Dependency resilience",
};

const RULE_DESCRIPTIONS: Record<PatternKey, string> = {
  "review-hygiene": "Convert repeated review feedback into enforceable implementation checks.",
  "sensitive-logging": "Redact sensitive payload fields before logs leave process boundaries.",
  "auth-token-handling": "Prevent credential propagation across service boundaries.",
  "error-contract": "Keep handler response contracts and error envelopes structurally consistent.",
  "concurrency-serialization": "Serialize concurrent writes around shared mutable resources.",
  idempotency: "Enforce idempotency keys and duplicate-write guards.",
  "retry-strategy": "Bound retry behavior with backoff and failure caps.",
  "input-validation": "Validate external input before side effects or persistence.",
  "state-transition": "Guard allowed state transitions with explicit invariants.",
  "dependency-resilience": "Harden upstream/downstream integration boundaries and fallbacks.",
};

interface PatternMappingInput {
  title?: string | null;
  pattern?: string | null;
  whatHappened?: string | null;
  fix?: string | null;
  triggers?: string[] | null;
}

function collectCorpus(input: PatternMappingInput) {
  return [
    input.title ?? "",
    input.pattern ?? "",
    input.whatHappened ?? "",
    input.fix ?? "",
    ...(input.triggers ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function addScoreIfMatch(
  score: Map<PatternKey, number>,
  corpus: string,
  key: PatternKey,
  rules: RegExp[],
  points = 1,
) {
  if (rules.some((rule) => rule.test(corpus))) {
    score.set(key, (score.get(key) ?? 0) + points);
  }
}

export function mapToPatternKey(input: PatternMappingInput): PatternKey {
  const corpus = collectCorpus(input);
  const score = new Map<PatternKey, number>();

  addScoreIfMatch(score, corpus, "sensitive-logging", [
    /\blog(s|ging)?\b/,
    /\b(redact|mask|sanitize)\b/,
    /\bpii\b/,
    /\bpci\b/,
    /\bpan\b/,
    /\bsensitive\b/,
  ]);
  addScoreIfMatch(score, corpus, "auth-token-handling", [
    /\btoken(s)?\b/,
    /\bbearer\b/,
    /\bcredential(s)?\b/,
    /\bauth(entication|orization)?\b/,
    /\bsession\b/,
    /\bjwt\b/,
  ]);
  addScoreIfMatch(score, corpus, "error-contract", [
    /\berror\b/,
    /\bresponse\b/,
    /\bschema\b/,
    /\bshape\b/,
    /\bcontract\b/,
    /\bstatus code\b/,
  ]);
  addScoreIfMatch(score, corpus, "concurrency-serialization", [
    /\bconcurren(t|cy)\b/,
    /\brace\b/,
    /\binterleav(e|ing)\b/,
    /\bserialize\b/,
    /\block(s)?\b/,
    /\bmutex\b/,
  ]);
  addScoreIfMatch(score, corpus, "idempotency", [
    /\bidempotent\b/,
    /\bidempotency\b/,
    /\bduplicate(s|d)?\b/,
    /\breplay\b/,
  ]);
  addScoreIfMatch(score, corpus, "retry-strategy", [
    /\bretr(y|ies)\b/,
    /\bbackoff\b/,
    /\btimeout(s)?\b/,
    /\bcircuit breaker\b/,
  ]);
  addScoreIfMatch(score, corpus, "input-validation", [
    /\bvalidat(e|ion)\b/,
    /\bsanitiz(e|ation)\b/,
    /\bconstraint(s)?\b/,
    /\bguard rail(s)?\b/,
  ]);
  addScoreIfMatch(score, corpus, "state-transition", [
    /\bstate\b/,
    /\btransition\b/,
    /\bworkflow\b/,
    /\binvariant(s)?\b/,
  ]);
  addScoreIfMatch(score, corpus, "dependency-resilience", [
    /\bupstream\b/,
    /\bdownstream\b/,
    /\bprovider\b/,
    /\bexternal service\b/,
    /\bdependency\b/,
  ]);
  addScoreIfMatch(score, corpus, "review-hygiene", [
    /\breview\b/,
    /\bcomment\b/,
    /\bcleanup\b/,
    /\brefactor\b/,
  ]);

  const sorted = PATTERN_PRIORITY.slice().sort((left, right) => {
    const leftScore = score.get(left) ?? 0;
    const rightScore = score.get(right) ?? 0;

    if (leftScore === rightScore) {
      return PATTERN_PRIORITY.indexOf(left) - PATTERN_PRIORITY.indexOf(right);
    }

    return rightScore - leftScore;
  });

  const winner = sorted[0];
  if (!winner || (score.get(winner) ?? 0) === 0) {
    return "review-hygiene";
  }

  return winner;
}

export function patternLabelForKey(key: PatternKey) {
  return PATTERN_LABELS[key];
}

export function buildRuleTitleForKey(key: PatternKey) {
  return `Guard against ${PATTERN_LABELS[key].toLowerCase()}`;
}

export function buildRuleDescriptionForKey(key: PatternKey) {
  return RULE_DESCRIPTIONS[key];
}

export type SuperCategory = "safety" | "resilience" | "security" | "flow";

export const SUPER_CATEGORY_KEYS = ["safety", "resilience", "security", "flow"] as const;

export const SUPER_CATEGORY_LABELS: Record<SuperCategory, string> = {
  safety: "Safety",
  resilience: "Resilience",
  security: "Security",
  flow: "Flow",
};

export const PATTERN_SUPER_CATEGORY: Record<PatternKey, SuperCategory> = {
  "error-contract": "safety",
  "input-validation": "safety",
  "retry-strategy": "resilience",
  "dependency-resilience": "resilience",
  idempotency: "resilience",
  "sensitive-logging": "security",
  "auth-token-handling": "security",
  "concurrency-serialization": "flow",
  "state-transition": "flow",
  "review-hygiene": "flow",
};

export function getSuperCategoryForPattern(key: PatternKey): SuperCategory {
  return PATTERN_SUPER_CATEGORY[key];
}
