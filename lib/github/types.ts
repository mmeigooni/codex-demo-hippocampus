export interface GitHubRepo {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  updatedAt: string;
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string;
  authorLogin: string | null;
  htmlUrl: string;
  state: "open" | "closed";
  mergedAt: string | null;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface GitHubReviewComment {
  id: number;
  reviewId: number | null;
  body: string;
  authorLogin: string | null;
  path: string;
  line: number | null;
  side: "LEFT" | "RIGHT" | null;
  commitId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubReview {
  id: number;
  body: string;
  state: string;
  submittedAt: string | null;
  authorLogin: string | null;
  comments: GitHubReviewComment[];
}

export interface ImportRepoRequest {
  owner: string;
  repo: string;
}

export type ImportEventType =
  | "pr_found"
  | "encoding_start"
  | "episode_created"
  | "encoding_error"
  | "complete";

export interface ImportEvent<T = Record<string, unknown>> {
  type: ImportEventType;
  data: T;
}
