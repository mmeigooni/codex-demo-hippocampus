import type { GitHubPR, GitHubReview } from "@/lib/github/types";

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
