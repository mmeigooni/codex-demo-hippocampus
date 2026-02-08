import { describe, expect, it } from "vitest";

import {
  filterPublicRepos,
  isPrivateRepo,
  MISSING_PROVIDER_TOKEN_MESSAGE,
  PRIVATE_REPOS_NOT_SUPPORTED_MESSAGE,
} from "../lib/github/public-only-policy";
import type { GitHubRepo } from "../lib/github/types";

describe("public-only GitHub policy", () => {
  it("keeps only public repositories", () => {
    const repos: GitHubRepo[] = [
      {
        id: 1,
        owner: "acme",
        name: "public-repo",
        fullName: "acme/public-repo",
        private: false,
        htmlUrl: "https://github.com/acme/public-repo",
        defaultBranch: "main",
        updatedAt: "2026-02-08T00:00:00.000Z",
      },
      {
        id: 2,
        owner: "acme",
        name: "private-repo",
        fullName: "acme/private-repo",
        private: true,
        htmlUrl: "https://github.com/acme/private-repo",
        defaultBranch: "main",
        updatedAt: "2026-02-08T00:00:00.000Z",
      },
      {
        id: 3,
        owner: "acme",
        name: "another-public",
        fullName: "acme/another-public",
        private: false,
        htmlUrl: "https://github.com/acme/another-public",
        defaultBranch: "main",
        updatedAt: "2026-02-08T00:00:00.000Z",
      },
    ];

    const result = filterPublicRepos(repos);

    expect(result).toHaveLength(2);
    expect(result.every((repo) => repo.private === false)).toBe(true);
    expect(result.map((repo) => repo.fullName)).toEqual([
      "acme/public-repo",
      "acme/another-public",
    ]);
  });

  it("marks private repo visibility correctly", () => {
    const privateRepo: GitHubRepo = {
      id: 10,
      owner: "acme",
      name: "private-repo",
      fullName: "acme/private-repo",
      private: true,
      htmlUrl: "https://github.com/acme/private-repo",
      defaultBranch: "main",
      updatedAt: "2026-02-08T00:00:00.000Z",
    };
    const publicRepo: GitHubRepo = {
      id: 11,
      owner: "acme",
      name: "public-repo",
      fullName: "acme/public-repo",
      private: false,
      htmlUrl: "https://github.com/acme/public-repo",
      defaultBranch: "main",
      updatedAt: "2026-02-08T00:00:00.000Z",
    };

    expect(isPrivateRepo(privateRepo)).toBe(true);
    expect(isPrivateRepo(publicRepo)).toBe(false);
  });

  it("uses stable policy messages", () => {
    expect(MISSING_PROVIDER_TOKEN_MESSAGE).toContain("Re-authenticate with GitHub");
    expect(PRIVATE_REPOS_NOT_SUPPORTED_MESSAGE).toContain("public-only mode");
  });
});
