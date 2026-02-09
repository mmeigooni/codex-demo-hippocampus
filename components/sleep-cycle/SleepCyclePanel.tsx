"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { ReasoningCard } from "@/components/feed/ReasoningCard";
import { DreamState } from "@/components/sleep-cycle/DreamState";
import { PackOutputView } from "@/components/sleep-cycle/PackOutputView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConsolidationStream } from "@/hooks/useConsolidationStream";
import { useDistributionStream } from "@/hooks/useDistributionStream";
import type { ConsolidationModelOutput } from "@/lib/codex/types";
import { distributionFallbackMessage } from "@/lib/distribution/ui-state";

interface SleepCycleRepoOption {
  id: string;
  fullName: string;
  episodeCount?: number;
  ruleCount?: number;
}

interface SleepCyclePanelProps {
  repos: SleepCycleRepoOption[];
  defaultRepoId?: string | null;
  initialPack?: ConsolidationModelOutput | null;
}

export function SleepCyclePanel({ repos, defaultRepoId = null, initialPack = null }: SleepCyclePanelProps) {
  const [selectedRepoId, setSelectedRepoId] = useState<string>(defaultRepoId ?? repos[0]?.id ?? "");

  const {
    runConsolidation,
    phase,
    progress,
    isRunning,
    error,
    storageMode,
    summary,
    reasoningText,
    isReasoningActive,
  } = useConsolidationStream({ initialPack });

  const {
    runDistribution,
    isDistributing,
    distributionResult,
    distributionPhase,
    copiedMarkdown,
    copyDistributionMarkdown,
  } = useDistributionStream();

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.id === selectedRepoId) ?? null,
    [repos, selectedRepoId],
  );

  const livePack = useMemo(() => summary?.pack ?? null, [summary]);

  const distributeButtonLabel = isDistributing
    ? distributionPhase ?? "Distributing..."
    : distributionResult && !distributionResult.error
      ? "Distributed"
      : "Distribute to repo";

  const handleRunConsolidation = async () => {
    if (!selectedRepoId) {
      return;
    }

    await runConsolidation(selectedRepoId);
  };

  const handleRunDistribution = async () => {
    if (!selectedRepoId || !livePack) {
      return;
    }

    await runDistribution(selectedRepoId);
  };

  if (repos.length === 0) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-zinc-100">Sleep Cycle</CardTitle>
          <CardDescription>Import a repository first to build episodic memory.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader className="space-y-3">
          <CardTitle className="text-zinc-100">Consolidation run</CardTitle>
          <CardDescription>
            Trigger a sleep cycle to detect patterns and promote durable team rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-2 text-sm text-zinc-300">
            <span>Repository</span>
            <select
              value={selectedRepoId}
              onChange={(event) => setSelectedRepoId(event.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              disabled={isRunning || isDistributing}
            >
              {repos.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.fullName} ({repo.episodeCount ?? 0} episodes / {repo.ruleCount ?? 0} rules)
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRunConsolidation} disabled={isRunning || isDistributing || !selectedRepo}>
              {isRunning ? "Running sleep cycle..." : "Run sleep cycle"}
            </Button>
            {error ? (
              <Button onClick={handleRunConsolidation} disabled={isRunning || isDistributing || !selectedRepo} variant="secondary">
                Retry
              </Button>
            ) : null}
          </div>

          {selectedRepo ? (
            <p className="text-xs text-zinc-500">
              Active repo: {selectedRepo.fullName} ({selectedRepo.episodeCount ?? 0} episodes)
            </p>
          ) : null}

          <AnimatePresence>
            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <p role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                  {error}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {storageMode === "memory-fallback" ? (
              <motion.div
                key="storage-warning"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100/90">
                  Local fallback mode active: consolidation data is being read from and written to in-memory runtime
                  storage.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </CardContent>
      </Card>

      <DreamState
        phase={phase}
        patterns={progress.patterns}
        rules={progress.rules}
        salienceUpdates={progress.salienceUpdates}
        contradictions={progress.contradictions}
      />

      <AnimatePresence>
        {isReasoningActive || reasoningText ? (
          <motion.div
            key="reasoning"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            <ReasoningCard text={reasoningText} isActive={isReasoningActive} index={0} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-zinc-100">Pack output</CardTitle>
          <CardDescription>Promoted rules, contradictions, and salience deltas from this run.</CardDescription>
        </CardHeader>
        <CardContent>
          <PackOutputView pack={livePack} />
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-zinc-100">Distribution</CardTitle>
          <CardDescription>Create a GitHub PR for `.codex/team-memory.md` from the latest completed run.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleRunDistribution} disabled={isRunning || isDistributing || !selectedRepo || !livePack}>
            {distributeButtonLabel}
          </Button>

          {distributionPhase && isDistributing ? <p className="text-xs text-zinc-400">{distributionPhase}</p> : null}

          {distributionResult?.error ? (
            <p role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
              {distributionResult.error}
            </p>
          ) : null}

          {distributionResult && !distributionResult.error && distributionResult.prUrl ? (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              Distribution complete. Open PR{" "}
              <a
                href={distributionResult.prUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-emerald-300/70 underline-offset-2"
              >
                #{distributionResult.prNumber ?? "?"}
              </a>
              {distributionResult.branch ? ` (branch: ${distributionResult.branch})` : ""}.
            </p>
          ) : null}

          {distributionResult && !distributionResult.error && distributionResult.skippedPr ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100/90">
              {distributionFallbackMessage(distributionResult.reason)}
            </p>
          ) : null}

          {distributionResult?.markdown ? (
            <details className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
              <summary className="cursor-pointer text-sm text-zinc-200">Rendered `.codex/team-memory.md`</summary>
              <div className="mt-3 space-y-2">
                <Button onClick={copyDistributionMarkdown} variant="secondary" size="sm">
                  {copiedMarkdown ? "Copied" : "Copy markdown"}
                </Button>
                <pre className="max-h-80 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200">
                  {distributionResult.markdown}
                </pre>
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
