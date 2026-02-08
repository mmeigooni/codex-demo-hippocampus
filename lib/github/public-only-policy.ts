import type { GitHubRepo } from "@/lib/github/types";

export const MISSING_PROVIDER_TOKEN_MESSAGE =
  "Missing GitHub provider token. Re-authenticate with GitHub to continue.";

export const PRIVATE_REPOS_NOT_SUPPORTED_MESSAGE =
  "Private repositories are not supported in public-only mode.";

export function filterPublicRepos(repos: GitHubRepo[]) {
  return repos.filter((repo) => !repo.private);
}

export function isPrivateRepo(repo: GitHubRepo) {
  return repo.private;
}
