import { Octokit } from "octokit";

import type {
  GitHubPR,
  GitHubRepo,
  GitHubReview,
  GitHubReviewComment,
} from "@/lib/github/types";

const DEFAULT_PULL_REQUEST_LIMIT = 20;

function createGitHubClient(token?: string) {
  return new Octokit({
    auth: token,
    userAgent: "hippocampus/0.1.0",
  });
}

function toRepo(repo: {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  owner: { login: string } | null;
  updated_at: string | null;
}): GitHubRepo {
  return {
    id: repo.id,
    owner: repo.owner?.login ?? "",
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch,
    updatedAt: repo.updated_at ?? new Date(0).toISOString(),
  };
}

function toPullRequest(pr: {
  id: number;
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
  html_url: string;
  state: string;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  additions?: number;
  deletions?: number;
  changed_files?: number;
}): GitHubPR {
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body ?? "",
    authorLogin: pr.user?.login ?? null,
    htmlUrl: pr.html_url,
    state: pr.state === "open" ? "open" : "closed",
    mergedAt: pr.merged_at,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    changedFiles: pr.changed_files ?? 0,
  };
}

function toReviewComment(comment: {
  id: number;
  pull_request_review_id: number | null;
  body: string;
  user: { login: string } | null;
  path: string;
  line?: number | null;
  side?: "LEFT" | "RIGHT" | null;
  commit_id: string;
  created_at: string;
  updated_at: string;
}): GitHubReviewComment {
  return {
    id: comment.id,
    reviewId: comment.pull_request_review_id,
    body: comment.body,
    authorLogin: comment.user?.login ?? null,
    path: comment.path,
    line: comment.line ?? null,
    side: comment.side ?? null,
    commitId: comment.commit_id,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  };
}

function parseGitHubError(error: unknown): Error {
  if (typeof error === "object" && error && "message" in error) {
    const withMessage = error as { message: string; status?: number };
    const statusSuffix = withMessage.status ? ` (status ${withMessage.status})` : "";
    return new Error(`GitHub API request failed${statusSuffix}: ${withMessage.message}`);
  }

  return new Error("GitHub API request failed");
}

export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const octokit = createGitHubClient(token);

  try {
    const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      sort: "updated",
      per_page: 100,
    });

    return repos.map((repo) => toRepo(repo));
  } catch (error) {
    throw parseGitHubError(error);
  }
}

export async function fetchRepo(owner: string, repo: string, token?: string): Promise<GitHubRepo> {
  const octokit = createGitHubClient(token);

  try {
    const response = await octokit.rest.repos.get({
      owner,
      repo,
    });

    return toRepo(response.data);
  } catch (error) {
    throw parseGitHubError(error);
  }
}

export async function fetchMergedPRs(
  owner: string,
  repo: string,
  limit = DEFAULT_PULL_REQUEST_LIMIT,
  token?: string,
): Promise<GitHubPR[]> {
  const octokit = createGitHubClient(token);

  try {
    const pulls = await octokit.paginate(octokit.rest.pulls.list, {
      owner,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: 100,
    });

    return pulls
      .filter((pr) => pr.merged_at !== null)
      .slice(0, limit)
      .map((pr) => toPullRequest(pr));
  } catch (error) {
    throw parseGitHubError(error);
  }
}

export async function fetchPRReviews(
  owner: string,
  repo: string,
  prNumber: number,
  token?: string,
): Promise<GitHubReview[]> {
  const octokit = createGitHubClient(token);

  try {
    const [reviews, reviewComments] = await Promise.all([
      octokit.paginate(octokit.rest.pulls.listReviews, {
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      }),
      octokit.paginate(octokit.rest.pulls.listReviewComments, {
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      }),
    ]);

    const commentMap = new Map<number, GitHubReviewComment[]>();

    for (const comment of reviewComments) {
      const reviewId = comment.pull_request_review_id;
      if (!reviewId) {
        continue;
      }

      const mappedComment = toReviewComment(comment);
      const existing = commentMap.get(reviewId) ?? [];
      existing.push(mappedComment);
      commentMap.set(reviewId, existing);
    }

    return reviews.map((review) => ({
      id: review.id,
      body: review.body ?? "",
      state: review.state,
      submittedAt: review.submitted_at ?? null,
      authorLogin: review.user?.login ?? null,
      comments: commentMap.get(review.id) ?? [],
    }));
  } catch (error) {
    throw parseGitHubError(error);
  }
}

export async function fetchPRDiff(
  owner: string,
  repo: string,
  prNumber: number,
  token?: string,
): Promise<string> {
  const octokit = createGitHubClient(token);

  try {
    const response = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner,
      repo,
      pull_number: prNumber,
      headers: {
        accept: "application/vnd.github.v3.diff",
      },
    });

    if (typeof response.data !== "string") {
      throw new Error("GitHub diff response was not a string payload");
    }

    return response.data;
  } catch (error) {
    throw parseGitHubError(error);
  }
}
