"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GitHubRepo } from "@/lib/github/types";

interface RepoSelectorProps {
  demoRepoFullName: string;
  onSelectRepo: (repo: { owner: string; repo: string }) => void;
  disabled?: boolean;
}

function parseFullName(fullName: string) {
  const [owner, repo] = fullName.split("/");

  if (!owner || !repo) {
    return null;
  }

  return { owner, repo };
}

export function RepoSelector({ demoRepoFullName, onSelectRepo, disabled = false }: RepoSelectorProps) {
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [selectedFullName, setSelectedFullName] = useState<string>("");

  const demoRepo = useMemo(() => parseFullName(demoRepoFullName), [demoRepoFullName]);

  const loadRepos = async () => {
    setLoadingRepos(true);
    setRepoError(null);

    try {
      const response = await fetch("/api/github/repos", { method: "GET" });
      const payload = (await response.json()) as { repos?: GitHubRepo[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to fetch repositories");
      }

      setRepos(payload.repos ?? []);
      if (!selectedFullName && payload.repos?.[0]) {
        setSelectedFullName(payload.repos[0].fullName);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch repositories";
      setRepoError(message);
    } finally {
      setLoadingRepos(false);
    }
  };

  const connectDemoRepo = () => {
    if (!demoRepo) {
      return;
    }

    onSelectRepo(demoRepo);
  };

  const connectSelectedRepo = () => {
    const parsed = parseFullName(selectedFullName);
    if (!parsed) {
      return;
    }

    onSelectRepo(parsed);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-cyan-700/30 bg-zinc-900/60">
        <CardHeader>
          <CardTitle className="text-zinc-100">Recommended demo repo</CardTitle>
          <CardDescription>{demoRepoFullName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-300">
            Start with the canonical demo corpus to populate your memory graph quickly.
          </p>
          <Button onClick={connectDemoRepo} disabled={disabled || !demoRepo} className="w-full">
            Import {demoRepoFullName}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-zinc-100">Connect your own repo</CardTitle>
          <CardDescription>Load your public GitHub repositories only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={loadRepos} variant="secondary" disabled={disabled || loadingRepos} className="w-full">
            {loadingRepos ? "Loading repos..." : "Load my repositories"}
          </Button>

          <label className="block space-y-2 text-sm text-zinc-300">
            <span>Select repository</span>
            <select
              value={selectedFullName}
              onChange={(event) => setSelectedFullName(event.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              disabled={disabled || repos.length === 0}
            >
              <option value="">Choose a repository...</option>
              {repos.map((repo) => (
                <option key={repo.id} value={repo.fullName}>
                  {repo.fullName}
                </option>
              ))}
            </select>
          </label>

          <Button
            onClick={connectSelectedRepo}
            disabled={disabled || !selectedFullName}
            className="w-full"
          >
            Import selected repository
          </Button>

          {!loadingRepos && repos.length === 0 && !repoError ? (
            <p className="text-xs text-zinc-500">
              No public repositories found for this account.
            </p>
          ) : null}
          {repoError ? <p className="text-sm text-red-300">{repoError}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
