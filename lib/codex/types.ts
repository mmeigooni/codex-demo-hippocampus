import type { GitHubPR, GitHubReview } from "@/lib/github/types";
import type { PatternKey } from "@/lib/memory/pattern-taxonomy";

export interface EpisodeNarrativeFields {
  what_happened: string;
  the_pattern: string;
  the_fix: string;
  why_it_matters: string;
  salience_score: number;
  triggers: string[];
}

export interface EpisodeEncodingInput {
  owner: string;
  repo: string;
  pr: GitHubPR;
  reviews: GitHubReview[];
  snippets: string[];
}

export interface EpisodeInsertPayload {
  source_pr_number: number;
  title: string;
  who: string | null;
  what_happened: string;
  pattern_key: PatternKey;
  the_pattern: string;
  the_fix: string;
  why_it_matters: string;
  salience_score: number;
  triggers: string[];
  source_url: string;
  happened_at: string | null;
}

export interface EncodedEpisodeResult {
  episode: EpisodeInsertPayload;
  narrative: EpisodeNarrativeFields;
  reviewCount: number;
  snippetCount: number;
}

export interface ConsolidationEpisodeInput {
  id: string;
  title: string;
  what_happened: string | null;
  pattern_key: PatternKey;
  the_pattern: string | null;
  the_fix: string | null;
  why_it_matters: string | null;
  salience_score: number;
  triggers: string[];
  source_pr_number: number | null;
  source_url: string | null;
}

export interface ConsolidationRuleInput {
  id: string;
  rule_key: PatternKey;
  title: string;
  description: string;
  triggers: string[];
  source_episode_ids: string[];
  confidence: number;
}

export interface ConsolidationPattern {
  name: string;
  episode_ids: string[];
  summary: string;
}

export interface ConsolidationRuleCandidate {
  rule_key: PatternKey;
  title: string;
  description: string;
  triggers: string[];
  source_episode_ids: string[];
}

export interface ConsolidationContradiction {
  left_episode_id: string;
  right_episode_id: string;
  reason: string;
}

export interface ConsolidationSalienceUpdate {
  episode_id: string;
  salience_score: number;
  reason: string;
}

export interface ConsolidationModelOutput {
  patterns: ConsolidationPattern[];
  rules_to_promote: ConsolidationRuleCandidate[];
  contradictions: ConsolidationContradiction[];
  salience_updates: ConsolidationSalienceUpdate[];
  prune_candidates: string[];
}

export interface ConsolidationResult extends ConsolidationModelOutput {
  used_fallback: boolean;
}

export type ConsolidationEventType =
  | "consolidation_start"
  | "pattern_detected"
  | "rule_promoted"
  | "contradiction_found"
  | "salience_updated"
  | "consolidation_complete"
  | "consolidation_error";

export interface ConsolidationEvent<T = unknown> {
  type: ConsolidationEventType;
  data: T;
}
