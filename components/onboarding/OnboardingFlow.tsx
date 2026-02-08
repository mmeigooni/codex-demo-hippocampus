"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import type { BrainEdgeModel, BrainNodeModel } from "@/components/brain/types";
import { NeuralActivityFeed } from "@/components/feed/NeuralActivityFeed";
import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { RepoSelector } from "@/components/onboarding/RepoSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImportEvent, ImportRepoRequest } from "@/lib/github/types";

interface OnboardingFlowProps {
  demoRepoFullName: string;
}

type ImportPhase = "idle" | "importing" | "ready" | "error";
type StorageMode = "supabase" | "memory-fallback";
type OnboardingPhase =
  | "idle"
  | "importing"
  | "ready"
  | "consolidating"
  | "consolidated"
  | "distributing"
  | "distributed"
  | "error";

interface ParsedImportEvent {
  type: string;
  data: Record<string, unknown>;
}

interface GraphPayload {
  nodes: BrainNodeModel[];
  edges: BrainEdgeModel[];
  stats: {
    episodeCount: number;
    ruleCount: number;
  };
}

const EMPTY_GRAPH: GraphPayload = {
  nodes: [],
  edges: [],
  stats: {
    episodeCount: 0,
    ruleCount: 0,
  },
};

const BrainScene = dynamic(
  () => import("@/components/brain/BrainScene").then((module) => module.BrainScene),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        Loading memory graph...
      </div>
    ),
  },
);

const PHASE_ORDER: Record<OnboardingPhase, number> = {
  idle: 0,
  importing: 1,
  ready: 2,
  consolidating: 3,
  consolidated: 4,
  distributing: 5,
  distributed: 6,
  error: 7,
};

function moveForwardPhase(current: OnboardingPhase, next: OnboardingPhase) {
  return PHASE_ORDER[next] >= PHASE_ORDER[current] ? next : current;
}

function extractEventsFromBuffer(rawBuffer: string) {
  const chunks = rawBuffer.split("\n\n");
  const remainder = chunks.pop() ?? "";

  const events = chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap((chunk) => {
      const line = chunk
        .split("\n")
        .find((chunkLine) => chunkLine.startsWith("data: "));

      if (!line) {
        return [];
      }

      const payloadText = line.slice(6);

      try {
        return [JSON.parse(payloadText) as ParsedImportEvent];
      } catch {
        return [];
      }
    });

  return { events, remainder };
}

function toActivityEvent(event: ImportEvent, index: number): ActivityEventView {
  const prefix = `${event.type}-${index}`;

  if (event.type === "pr_found") {
    return {
      id: prefix,
      type: event.type,
      title: `Discovered ${String(event.data.count ?? 0)} merged pull requests`,
      raw: event.data,
    };
  }

  if (event.type === "encoding_start") {
    return {
      id: prefix,
      type: event.type,
      title: `Encoding PR #${String(event.data.pr_number ?? "?")}`,
      subtitle: String(event.data.title ?? "Untitled PR"),
      raw: event.data,
    };
  }

  if (event.type === "episode_created") {
    const episode = event.data.episode as
      | { title?: string; salience_score?: number; the_pattern?: string; triggers?: string[] }
      | undefined;

    const reduction = event.data.token_reduction as
      | { reductionRatio?: number; rawTokens?: number; reducedTokens?: number }
      | undefined;

    const ratio = reduction?.reductionRatio ?? 0;

    return {
      id: prefix,
      type: event.type,
      title: episode?.title ?? "Episode created",
      subtitle: `pattern: ${String(episode?.the_pattern ?? "unknown")}`,
      salience: Number(episode?.salience_score ?? 0),
      triggers: Array.isArray(episode?.triggers) ? episode.triggers : [],
      snippet:
        reduction && typeof ratio === "number"
          ? `token reduction ${(ratio * 100).toFixed(0)}% (${reduction.reducedTokens}/${reduction.rawTokens})`
          : undefined,
      raw: event.data,
    };
  }

  if (event.type === "episode_skipped") {
    return {
      id: prefix,
      type: event.type,
      title: `Skipped PR #${String(event.data.pr_number ?? "?")}`,
      subtitle: `${String(event.data.title ?? "Untitled PR")} — already imported`,
      raw: event.data,
    };
  }

  if (event.type === "encoding_error") {
    return {
      id: prefix,
      type: event.type,
      title: `Import error on PR #${String(event.data.pr_number ?? "?")}`,
      subtitle: String(event.data.message ?? "Unknown error"),
      raw: event.data,
    };
  }

  const failed = Number(event.data.failed ?? 0);
  return {
    id: prefix,
    type: event.type,
    title: `Import complete: ${String(event.data.total ?? 0)} episodes created`,
    subtitle: failed > 0 ? `${failed} PR(s) failed encoding` : undefined,
    raw: event.data,
  };
}

async function loadGraph(repoSelection: ImportRepoRequest) {
  const query = new URLSearchParams({
    owner: repoSelection.owner,
    repo: repoSelection.repo,
  });

  const response = await fetch(`/api/graph?${query.toString()}`, {
    method: "GET",
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        nodes?: BrainNodeModel[];
        edges?: BrainEdgeModel[];
        stats?: { episodeCount?: number; ruleCount?: number };
        error?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to load memory graph");
  }

  return {
    nodes: Array.isArray(payload?.nodes) ? payload.nodes : [],
    edges: Array.isArray(payload?.edges) ? payload.edges : [],
    stats: {
      episodeCount: Number(payload?.stats?.episodeCount ?? 0),
      ruleCount: Number(payload?.stats?.ruleCount ?? 0),
    },
  } satisfies GraphPayload;
}

export function OnboardingFlow({ demoRepoFullName }: OnboardingFlowProps) {
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [activeSelection, setActiveSelection] = useState<ImportRepoRequest | null>(null);
  const [lastSelection, setLastSelection] = useState<ImportRepoRequest | null>(null);
  const [events, setEvents] = useState<ImportEvent[]>([]);
  const [phase, setPhase] = useState<OnboardingPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);
  const [graph, setGraph] = useState<GraphPayload>(EMPTY_GRAPH);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);

  const activityEvents = useMemo(() => {
    const mappedEvents = events.map((event, index) => toActivityEvent(event, index));

    if (phase === "importing" && mappedEvents.length === 0 && activeRepo) {
      return [
        {
          id: `bootstrap-${activeRepo}`,
          type: "import_bootstrap",
          title: `Preparing ${activeRepo}`,
          subtitle: "Verifying repository access and loading merged pull requests...",
          raw: { repo: activeRepo },
        } satisfies ActivityEventView,
      ];
    }

    return mappedEvents;
  }, [activeRepo, events, phase]);

  const statusText = useMemo(() => {
    if (phase === "importing") {
      if (events.length === 0) {
        return "Preparing import. Verifying repository access and scanning merged pull requests.";
      }

      return "Import in progress. Neural feed is live.";
    }

    if (phase === "ready") {
      const completeEvent = events.findLast((event) => event.type === "complete");
      const total = Number(completeEvent?.data.total ?? 0);
      const failed = Number(completeEvent?.data.failed ?? 0);
      const skipped = Number(completeEvent?.data.skipped ?? 0);

      if (total === 0 && skipped > 0 && failed === 0) {
        return `Import complete. ${skipped} episodes already imported.`;
      }

      if (failed > 0 && skipped > 0) {
        return `Import complete. ${total} episodes created (${skipped} already imported, ${failed} failed).`;
      }

      if (failed > 0) {
        return `Import complete. ${total} episodes created (${failed} failed).`;
      }

      if (skipped > 0) {
        return `Import complete. ${total} episodes created (${skipped} already imported).`;
      }

      return `Import complete. ${total} episodes created.`;
    }

    if (phase === "error") {
      return error ?? "Import encountered an error.";
    }

    return "Select a repository to begin.";
  }, [events, error, phase]);

  const refreshGraph = async (repoSelection: ImportRepoRequest) => {
    setGraphLoading(true);
    setGraphError(null);

    try {
      const graphPayload = await loadGraph(repoSelection);
      setGraph(graphPayload);
    } catch (graphFetchError) {
      const message = graphFetchError instanceof Error ? graphFetchError.message : "Failed to load memory graph";
      setGraphError(message);
    } finally {
      setGraphLoading(false);
    }
  };

  const startImport = async (repoSelection: ImportRepoRequest) => {
    setLastSelection(repoSelection);
    setActiveSelection(repoSelection);

    const fullName = `${repoSelection.owner}/${repoSelection.repo}`;
    setActiveRepo(fullName);
    setActiveRepoId(null);
    setEvents([]);
    setError(null);
    setStorageMode(null);
    setPhase("importing");

    await refreshGraph(repoSelection);

    try {
      const response = await fetch("/api/github/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(repoSelection),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to start import stream");
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
        const parsed = extractEventsFromBuffer(buffer);
        buffer = parsed.remainder;

        if (parsed.events.length > 0) {
          const chunkEvents = parsed.events as ImportEvent[];
          setEvents((current) => [...current, ...chunkEvents]);

          if (chunkEvents.some((event) => event.type === "encoding_error")) {
            setPhase((phaseCurrent) => moveForwardPhase(phaseCurrent, "error"));
          }

          if (chunkEvents.some((event) => event.type === "episode_created" || event.type === "complete")) {
            void refreshGraph(repoSelection);
          }

          if (chunkEvents.some((event) => event.type === "complete")) {
            const completeEvent = chunkEvents.findLast((event) => event.type === "complete");
            const completeData = completeEvent?.data as Record<string, unknown> | undefined;
            if (typeof completeData?.repo_id === "string") {
              setActiveRepoId(completeData.repo_id);
            }
            setPhase((phaseCurrent) => moveForwardPhase(phaseCurrent, "ready"));
          }
        }
      }

      await refreshGraph(repoSelection);
      setPhase((phaseCurrent) => moveForwardPhase(phaseCurrent, "ready"));
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "Import failed";
      setError(message);
      setPhase("error");
    }
  };

  const noConsolidatedRules = activeSelection && !graphLoading && graph.stats.ruleCount === 0;

  return (
    <div className="space-y-6">
      <RepoSelector
        demoRepoFullName={demoRepoFullName}
        onSelectRepo={startImport}
        disabled={phase === "importing"}
      />

      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-zinc-100">Neural activity and memory graph</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-300" aria-live="polite">
            {statusText}
          </p>
          {storageMode === "memory-fallback" ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100/90">
              <p>
                Local fallback mode active: import data is being persisted to in-memory runtime storage because
                Supabase schema cache is unavailable.
              </p>
              <p className="mt-1">Repeatability may vary while running in fallback mode.</p>
            </div>
          ) : null}
          {phase === "error" ? (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
              <p>{error ?? "Import encountered an error."}</p>
              {lastSelection ? (
                <button
                  type="button"
                  onClick={() => startImport(lastSelection)}
                  className="mt-2 inline-flex rounded-md border border-rose-300/40 px-3 py-1 text-xs hover:bg-rose-500/20"
                >
                  Retry import
                </button>
              ) : null}
            </div>
          ) : null}
          {graphError ? (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{graphError}</div>
          ) : null}
          {activeRepo ? <p className="text-xs text-zinc-500">Active repo: {activeRepo}</p> : null}
          {phase === "importing" && activeSelection && !graphLoading ? (
            <p className="text-xs text-cyan-100/80">
              Existing snapshot: {graph.stats.episodeCount} episodes loaded while import stream is in progress.
            </p>
          ) : null}
          {noConsolidatedRules ? (
            <p className="text-xs text-amber-100/90">Run Sleep Cycle to generate rules.</p>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <BrainScene nodes={graph.nodes} edges={graph.edges} />
            <div className="max-h-[440px] overflow-auto pr-1">
              <NeuralActivityFeed events={activityEvents} maxItems={14} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
