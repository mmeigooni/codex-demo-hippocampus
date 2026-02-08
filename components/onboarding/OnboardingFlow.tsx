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

interface ParsedImportEvent {
  type: string;
  data: Record<string, unknown>;
}

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

const PHASE_ORDER: Record<ImportPhase, number> = {
  idle: 0,
  importing: 1,
  ready: 2,
  error: 3,
};

function moveForwardPhase(current: ImportPhase, next: ImportPhase) {
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

  if (event.type === "encoding_error") {
    return {
      id: prefix,
      type: event.type,
      title: `Import error on PR #${String(event.data.pr_number ?? "?")}`,
      subtitle: String(event.data.message ?? "Unknown error"),
      raw: event.data,
    };
  }

  return {
    id: prefix,
    type: event.type,
    title: `Import complete: ${String(event.data.total ?? 0)} episodes created`,
    raw: event.data,
  };
}

function buildBrainGraph(events: ImportEvent[]) {
  const nodes = new Map<string, BrainNodeModel>();
  const edges: BrainEdgeModel[] = [];

  for (const event of events) {
    if (event.type !== "episode_created") {
      continue;
    }

    const episode = event.data.episode as
      | {
          id?: string;
          title?: string;
          salience_score?: number;
          the_pattern?: string;
          triggers?: string[];
        }
      | undefined;

    if (!episode?.id || !episode.title) {
      continue;
    }

    const episodeNodeId = `episode-${episode.id}`;
    const episodeNode: BrainNodeModel = {
      id: episodeNodeId,
      type: "episode",
      label: episode.title,
      salience: Number(episode.salience_score ?? 0),
      triggers: Array.isArray(episode.triggers) ? episode.triggers : [],
    };

    nodes.set(episodeNodeId, episodeNode);

    const rulePattern = String(episode.the_pattern ?? "unknown-pattern").slice(0, 80);
    const ruleNodeId = `rule-${rulePattern.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    if (!nodes.has(ruleNodeId)) {
      nodes.set(ruleNodeId, {
        id: ruleNodeId,
        type: "rule",
        label: rulePattern,
        salience: Math.max(4, Number(episode.salience_score ?? 0)),
        triggers: Array.isArray(episode.triggers) ? episode.triggers : [],
      });
    }

    edges.push({
      id: `${episodeNodeId}-${ruleNodeId}`,
      source: episodeNodeId,
      target: ruleNodeId,
      weight: Math.max(0.2, Math.min(1, Number(episode.salience_score ?? 0) / 10)),
    });
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
  };
}

export function OnboardingFlow({ demoRepoFullName }: OnboardingFlowProps) {
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [lastSelection, setLastSelection] = useState<ImportRepoRequest | null>(null);
  const [events, setEvents] = useState<ImportEvent[]>([]);
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);

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
  const graph = useMemo(() => buildBrainGraph(events), [events]);

  const statusText = useMemo(() => {
    if (phase === "importing") {
      if (events.length === 0) {
        return "Preparing import. Verifying repository access and scanning merged pull requests.";
      }

      return "Import in progress. Neural feed is live.";
    }

    if (phase === "ready") {
      const completeEvent = events.findLast((event) => event.type === "complete");
      return `Import complete. ${String(completeEvent?.data.total ?? 0)} episodes created.`;
    }

    if (phase === "error") {
      return error ?? "Import encountered an error.";
    }

    return "Select a repository to begin.";
  }, [events, error, phase]);

  const startImport = async (repoSelection: ImportRepoRequest) => {
    setLastSelection(repoSelection);
    const fullName = `${repoSelection.owner}/${repoSelection.repo}`;
    setActiveRepo(fullName);
    setEvents([]);
    setError(null);
    setStorageMode(null);
    setPhase("importing");

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

          if (chunkEvents.some((event) => event.type === "complete")) {
            setPhase((phaseCurrent) => moveForwardPhase(phaseCurrent, "ready"));
          }
        }
      }

      setPhase((phaseCurrent) => moveForwardPhase(phaseCurrent, "ready"));
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "Import failed";
      setError(message);
      setPhase("error");
    }
  };

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
              Local fallback mode active: import data is being persisted to in-memory runtime storage because
              Supabase schema cache is unavailable.
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
          {activeRepo ? <p className="text-xs text-zinc-500">Active repo: {activeRepo}</p> : null}

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
