"use client";

import { useMemo, useState } from "react";

import type {
  ConsolidationEvent,
  ConsolidationEventType,
  DistributionEvent,
} from "@/lib/codex/types";
import type { ConsolidationModelOutput } from "@/lib/codex/types";
import { distributionFallbackMessage } from "@/lib/distribution/ui-state";
import { parseJsonSseBuffer } from "@/lib/sse/parse";
import { DreamState, type DreamPhase } from "@/components/sleep-cycle/DreamState";
import { PackOutputView } from "@/components/sleep-cycle/PackOutputView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

interface ConsolidationSummary {
  counts?: {
    patterns?: number;
    rules_promoted?: number;
    salience_updates?: number;
    contradictions?: number;
  };
  pack?: ConsolidationModelOutput;
}

interface ConsolidationProgress {
  patterns: number;
  rules: number;
  salienceUpdates: number;
  contradictions: number;
}

interface DistributionResult {
  prUrl?: string;
  prNumber?: number;
  branch?: string;
  skippedPr: boolean;
  reason?: string;
  markdown?: string;
  error?: string;
}

interface DistributionCompleteEventData {
  skipped_pr: boolean;
  reason?: string;
  markdown: string;
  pr_url?: string;
  pr_number?: number;
  branch?: string;
}

type StorageMode = "supabase" | "memory-fallback";

function nextDreamPhase(current: DreamPhase, eventType: ConsolidationEventType): DreamPhase {
  if (eventType === "consolidation_error") {
    return "error";
  }

  if (eventType === "consolidation_complete") {
    return "complete";
  }

  if (eventType === "salience_updated" || eventType === "contradiction_found") {
    return "integrating";
  }

  if (eventType === "rule_promoted") {
    return "promoting";
  }

  if (eventType === "pattern_detected") {
    return "patterning";
  }

  if (eventType === "consolidation_start") {
    return "dozing";
  }

  return current;
}

function updateProgress(current: ConsolidationProgress, event: ConsolidationEvent): ConsolidationProgress {
  const data = event.data as Record<string, unknown>;

  if (event.type === "pattern_detected") {
    return { ...current, patterns: current.patterns + 1 };
  }

  if (event.type === "rule_promoted") {
    return { ...current, rules: current.rules + 1 };
  }

  if (event.type === "salience_updated") {
    return { ...current, salienceUpdates: current.salienceUpdates + 1 };
  }

  if (event.type === "contradiction_found") {
    return { ...current, contradictions: current.contradictions + 1 };
  }

  if (event.type === "consolidation_complete") {
    const summary = (data.summary ?? {}) as ConsolidationSummary;
    return {
      patterns: Number(summary.counts?.patterns ?? current.patterns),
      rules: Number(summary.counts?.rules_promoted ?? current.rules),
      salienceUpdates: Number(summary.counts?.salience_updates ?? current.salienceUpdates),
      contradictions: Number(summary.counts?.contradictions ?? current.contradictions),
    };
  }

  return current;
}

function eventHeadline(event: ConsolidationEvent) {
  const data = event.data as Record<string, unknown>;

  if (event.type === "consolidation_start") {
    return `Consolidation started (${String(data.episode_count ?? 0)} episodes)`;
  }

  if (event.type === "pattern_detected") {
    return `Pattern detected: ${String(data.name ?? "unnamed")}`;
  }

  if (event.type === "rule_promoted") {
    return `Rule promoted: ${String(data.title ?? "untitled")}`;
  }

  if (event.type === "contradiction_found") {
    return `Contradiction: ${String(data.reason ?? "unspecified")}`;
  }

  if (event.type === "salience_updated") {
    return `Salience updated for ${String(data.episode_id ?? "episode")}`;
  }

  if (event.type === "consolidation_complete") {
    return "Consolidation complete";
  }

  return String(data.message ?? "Consolidation failed");
}

export function SleepCyclePanel({ repos, defaultRepoId = null, initialPack = null }: SleepCyclePanelProps) {
  const [selectedRepoId, setSelectedRepoId] = useState<string>(defaultRepoId ?? repos[0]?.id ?? "");
  const [phase, setPhase] = useState<DreamPhase>("idle");
  const [events, setEvents] = useState<ConsolidationEvent[]>([]);
  const [progress, setProgress] = useState<ConsolidationProgress>({
    patterns: 0,
    rules: 0,
    salienceUpdates: 0,
    contradictions: 0,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionResult, setDistributionResult] = useState<DistributionResult | null>(null);
  const [distributionCompletePulse, setDistributionCompletePulse] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [summary, setSummary] = useState<ConsolidationSummary | null>(
    initialPack
      ? {
          counts: {
            patterns: initialPack.patterns.length,
            rules_promoted: initialPack.rules_to_promote.length,
            salience_updates: initialPack.salience_updates.length,
            contradictions: initialPack.contradictions.length,
          },
          pack: initialPack,
        }
      : null,
  );

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.id === selectedRepoId) ?? null,
    [repos, selectedRepoId],
  );

  const livePack = useMemo(() => summary?.pack ?? null, [summary]);
  const distributeButtonLabel = isDistributing
    ? "Distributing..."
    : distributionCompletePulse
      ? "Distributed"
      : "Distribute to repo";

  const runConsolidation = async () => {
    if (!selectedRepoId) {
      return;
    }

    setIsRunning(true);
    setError(null);
    setSummary(null);
    setStorageMode(null);
    setEvents([]);
    setDistributionResult(null);
    setDistributionCompletePulse(false);
    setCopiedMarkdown(false);
    setProgress({
      patterns: 0,
      rules: 0,
      salienceUpdates: 0,
      contradictions: 0,
    });
    setPhase("dozing");

    try {
      const response = await fetch("/api/consolidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_id: selectedRepoId }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to start consolidation stream");
      }

      const modeHeader = response.headers.get("x-hippocampus-storage-mode");
      if (modeHeader === "supabase" || modeHeader === "memory-fallback") {
        setStorageMode(modeHeader);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseJsonSseBuffer(buffer);
        buffer = parsed.remainder;

        if (parsed.events.length === 0) {
          continue;
        }

        const chunkEvents = parsed.events as ConsolidationEvent[];
        setEvents((current) => [...current, ...chunkEvents]);
        setProgress((current) => chunkEvents.reduce((next, event) => updateProgress(next, event), current));
        setPhase((current) => chunkEvents.reduce((next, event) => nextDreamPhase(next, event.type), current));

        const completeEvent = chunkEvents.findLast((event) => event.type === "consolidation_complete");
        if (completeEvent) {
          const data = completeEvent.data as Record<string, unknown>;
          const completeSummary = (data.summary ?? null) as ConsolidationSummary | null;
          setSummary(completeSummary);
        }

        const errorEvent = chunkEvents.findLast((event) => event.type === "consolidation_error");
        if (errorEvent) {
          const data = errorEvent.data as Record<string, unknown>;
          setError(String(data.message ?? "Consolidation failed"));
        }
      }
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Failed to run consolidation";
      setError(message);
      setPhase("error");
    } finally {
      setIsRunning(false);
    }
  };

  const runDistribution = async () => {
    if (!selectedRepoId || !livePack) {
      return;
    }

    setIsDistributing(true);
    setDistributionResult(null);
    setDistributionCompletePulse(false);
    setCopiedMarkdown(false);

    try {
      const response = await fetch("/api/distribute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_id: selectedRepoId }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to start distribution stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseJsonSseBuffer(buffer);
        buffer = parsed.remainder;

        if (parsed.events.length === 0) {
          continue;
        }

        const chunkEvents = parsed.events as DistributionEvent[];

        const completeEvent = chunkEvents.findLast((event) => event.type === "distribution_complete");
        if (completeEvent) {
          const data = completeEvent.data as DistributionCompleteEventData;
          setDistributionResult({
            prUrl: data.pr_url,
            prNumber: data.pr_number,
            branch: data.branch,
            skippedPr: Boolean(data.skipped_pr),
            reason: data.reason,
            markdown: data.markdown,
          });
          setDistributionCompletePulse(true);
          setTimeout(() => setDistributionCompletePulse(false), 3000);
        }

        const errorEvent = chunkEvents.findLast((event) => event.type === "distribution_error");
        if (errorEvent) {
          const data = errorEvent.data as Record<string, unknown>;
          setDistributionResult({
            skippedPr: true,
            error: String(data.message ?? "Distribution failed"),
          });
          setDistributionCompletePulse(false);
        }
      }
    } catch (distributionError) {
      const message = distributionError instanceof Error ? distributionError.message : "Failed to distribute pack";
      setDistributionResult({
        skippedPr: true,
        error: message,
      });
      setDistributionCompletePulse(false);
    } finally {
      setIsDistributing(false);
    }
  };

  const copyDistributionMarkdown = async () => {
    if (!distributionResult?.markdown) {
      return;
    }

    try {
      await navigator.clipboard.writeText(distributionResult.markdown);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    } catch {
      setCopiedMarkdown(false);
    }
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
            <Button onClick={runConsolidation} disabled={isRunning || isDistributing || !selectedRepo}>
              {isRunning ? "Running sleep cycle..." : "Run sleep cycle"}
            </Button>
            {error ? (
              <Button onClick={runConsolidation} disabled={isRunning || isDistributing || !selectedRepo} variant="secondary">
                Retry
              </Button>
            ) : null}
          </div>

          {selectedRepo ? (
            <p className="text-xs text-zinc-500">
              Active repo: {selectedRepo.fullName} ({selectedRepo.episodeCount ?? 0} episodes)
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          {storageMode === "memory-fallback" ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100/90">
              Local fallback mode active: consolidation data is being read from and written to in-memory runtime
              storage.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <DreamState
        phase={phase}
        patterns={progress.patterns}
        rules={progress.rules}
        salienceUpdates={progress.salienceUpdates}
        contradictions={progress.contradictions}
      />

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
          <Button onClick={runDistribution} disabled={isRunning || isDistributing || !selectedRepo || !livePack}>
            {distributeButtonLabel}
          </Button>

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

      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-zinc-100">Live consolidation stream</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-zinc-400">Waiting for consolidation events...</p>
          ) : (
            events.slice(-14).reverse().map((event, index) => (
              <div
                key={`${event.type}-${index}`}
                className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300"
              >
                <p className="font-mono uppercase tracking-wide text-cyan-300">{event.type}</p>
                <p className="mt-1">{eventHeadline(event)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
