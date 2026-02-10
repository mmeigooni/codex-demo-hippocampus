"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CrossSelectionState } from "@/components/brain/types";
import {
  EMPTY_GRAPH,
  moveForwardPhase,
  parseImportEventsFromBuffer,
  type GraphPayload,
  type OnboardingPhase,
  type StorageMode,
  toObject,
} from "@/components/onboarding/onboarding-activity";
import { useTheatricalScheduler } from "@/hooks/useTheatricalScheduler";
import { applyRulePromotedEvent, type AssociationMap } from "@/lib/feed/association-state";
import {
  resolveImportStreamMode,
  stripReplayManifest,
  type ImportStreamMode,
} from "@/lib/feed/import-stream-mode";
import type { ImportEvent, ImportRepoRequest } from "@/lib/github/types";

async function loadGraph(repoSelection: ImportRepoRequest): Promise<GraphPayload> {
  const response = await fetch(
    `/api/graph?owner=${encodeURIComponent(repoSelection.owner)}&repo=${encodeURIComponent(repoSelection.repo)}`,
  );

  const payload = (await response.json().catch(() => null)) as
    | {
        nodes?: GraphPayload["nodes"];
        edges?: GraphPayload["edges"];
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

export function useOnboardingImport() {
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
  const [consolidationRepoId, setConsolidationRepoId] = useState<string | null>(null);
  const [distributionRepoId, setDistributionRepoId] = useState<string | null>(null);
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string> | null>(null);
  const [visibleConsolidationNodeIds, setVisibleConsolidationNodeIds] = useState<Set<string> | null>(null);
  const [associations, setAssociations] = useState<AssociationMap>(new Map());
  const [crossSelection, setCrossSelection] = useState<CrossSelectionState>({
    selectedNodeId: null,
    source: "feed",
  });

  const importReplaySelectionRef = useRef<ImportRepoRequest | null>(null);
  const importReplayRunIdRef = useRef<number | null>(null);
  const importRunIdRef = useRef(0);
  const importAbortControllerRef = useRef<AbortController | null>(null);

  const refreshGraph = useCallback(
    async (repoSelection: ImportRepoRequest, options?: { guardRunId?: number }) => {
      const guardRunId = options?.guardRunId;
      if (guardRunId !== undefined && importRunIdRef.current !== guardRunId) {
        return;
      }

      setGraphLoading(true);
      setGraphError(null);

      try {
        const graphPayload = await loadGraph(repoSelection);
        if (guardRunId !== undefined && importRunIdRef.current !== guardRunId) {
          return;
        }
        setGraph(graphPayload);
      } catch (graphFetchError) {
        if (guardRunId !== undefined && importRunIdRef.current !== guardRunId) {
          return;
        }
        const message = graphFetchError instanceof Error ? graphFetchError.message : "Failed to load memory graph";
        setGraphError(message);
      } finally {
        if (guardRunId !== undefined && importRunIdRef.current !== guardRunId) {
          return;
        }
        setGraphLoading(false);
      }
    },
    [],
  );

  const applyImportEvents = useCallback(
    (chunkEvents: ImportEvent[], repoSelection: ImportRepoRequest, replayMode: boolean, runId?: number) => {
      if (runId !== undefined && importRunIdRef.current !== runId) {
        return;
      }

      const visibleEvents = chunkEvents.filter((event) => event.type !== "replay_manifest");
      if (visibleEvents.length === 0) {
        return;
      }

      setEvents((current) => [...current, ...visibleEvents]);

      if (visibleEvents.some((event) => event.type === "encoding_error")) {
        setPhase((phaseCurrent) => moveForwardPhase(phaseCurrent, "error"));
      }

      if (replayMode) {
        for (const event of visibleEvents) {
          if (event.type !== "episode_created") {
            continue;
          }

          const data = event.data as { episode?: { id?: unknown } };
          if (typeof data.episode?.id !== "string" || data.episode.id.length === 0) {
            continue;
          }

          const nodeId = `episode-${data.episode.id}`;
          setVisibleNodeIds((current) => {
            if (!current || current.has(nodeId)) {
              return current;
            }

            const next = new Set(current);
            next.add(nodeId);
            return next;
          });
        }
      }

      if (!replayMode && visibleEvents.some((event) => event.type === "episode_created" || event.type === "complete")) {
        void refreshGraph(repoSelection, runId !== undefined ? { guardRunId: runId } : undefined);
      }

      if (visibleEvents.some((event) => event.type === "complete")) {
        const completeEvent = visibleEvents.findLast((event) => event.type === "complete");
        const completeData = completeEvent ? toObject(completeEvent.data) : undefined;
        if (typeof completeData?.repo_id === "string") {
          setActiveRepoId(completeData.repo_id);
        }

        if (replayMode) {
          setVisibleNodeIds(null);
        }

        setPhase((phaseCurrent) => moveForwardPhase(phaseCurrent, "ready"));
      }
    },
    [refreshGraph],
  );

  const { enqueue: enqueueImportReplay, cancel: cancelImportReplay } = useTheatricalScheduler<ImportEvent>({
    onEventRelease: (event) => {
      const replayRunId = importReplayRunIdRef.current;
      if (replayRunId === null || importRunIdRef.current !== replayRunId) {
        return;
      }

      const selection = importReplaySelectionRef.current;
      if (!selection) {
        return;
      }

      applyImportEvents([event], selection, true, replayRunId);
    },
    onComplete: () => {
      const replayRunId = importReplayRunIdRef.current;
      if (replayRunId === null || importRunIdRef.current !== replayRunId) {
        return;
      }

      importReplaySelectionRef.current = null;
      importReplayRunIdRef.current = null;
    },
  });

  const startImport = useCallback(
    async (repoSelection: ImportRepoRequest) => {
      importAbortControllerRef.current?.abort();
      const controller = new AbortController();
      importAbortControllerRef.current = controller;

      const runId = importRunIdRef.current + 1;
      importRunIdRef.current = runId;

      setLastSelection(repoSelection);
      setActiveSelection(repoSelection);
      setActiveRepo(`${repoSelection.owner}/${repoSelection.repo}`);
      setActiveRepoId(null);
      setConsolidationRepoId(null);
      setDistributionRepoId(null);
      cancelImportReplay();
      importReplaySelectionRef.current = null;
      importReplayRunIdRef.current = null;
      setEvents([]);
      setError(null);
      setStorageMode(null);
      setVisibleNodeIds(new Set());
      setVisibleConsolidationNodeIds(null);
      setAssociations(new Map());
      setCrossSelection({ selectedNodeId: null, source: "feed" });
      setPhase("importing");

      try {
        const response = await fetch("/api/github/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(repoSelection),
          signal: controller.signal,
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
        let streamMode: ImportStreamMode = "unknown";
        const replayEvents: ImportEvent[] = [];
        const bufferedUnknownEvents: ImportEvent[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parsed = parseImportEventsFromBuffer(buffer);
          buffer = parsed.remainder;

          if (parsed.events.length === 0) {
            continue;
          }

          const chunkEvents = parsed.events as ImportEvent[];
          const nextMode = resolveImportStreamMode(streamMode, chunkEvents);

          if (streamMode === "unknown" && nextMode === "live") {
            setVisibleNodeIds(null);
            void refreshGraph(repoSelection, { guardRunId: runId });
          }

          streamMode = nextMode;

          if (streamMode === "unknown") {
            bufferedUnknownEvents.push(...chunkEvents);
            continue;
          }

          if (streamMode === "replay") {
            if (bufferedUnknownEvents.length > 0) {
              replayEvents.push(...stripReplayManifest(bufferedUnknownEvents));
              bufferedUnknownEvents.length = 0;
            }
            replayEvents.push(...stripReplayManifest(chunkEvents));
            continue;
          }

          if (bufferedUnknownEvents.length > 0) {
            applyImportEvents(bufferedUnknownEvents, repoSelection, false, runId);
            bufferedUnknownEvents.length = 0;
          }

          applyImportEvents(chunkEvents, repoSelection, false, runId);
        }

        if (streamMode === "replay") {
          if (replayEvents.length === 0) {
            setVisibleNodeIds(null);
            setPhase((phaseCurrent) => moveForwardPhase(phaseCurrent, "ready"));
          } else {
            await refreshGraph(repoSelection, { guardRunId: runId });
            importReplaySelectionRef.current = repoSelection;
            importReplayRunIdRef.current = runId;
            enqueueImportReplay(replayEvents);
          }
        } else {
          if (bufferedUnknownEvents.length > 0) {
            applyImportEvents(bufferedUnknownEvents, repoSelection, false, runId);
          }
          await refreshGraph(repoSelection, { guardRunId: runId });
          setPhase((phaseCurrent) => moveForwardPhase(phaseCurrent, "ready"));
        }
      } catch (importError) {
        if (importError instanceof Error && importError.name === "AbortError") {
          return;
        }

        const message = importError instanceof Error ? importError.message : "Import failed";
        setError(message);
        setPhase("error");
      }
    },
    [applyImportEvents, cancelImportReplay, enqueueImportReplay, refreshGraph],
  );

  const applyRuleAssociation = useCallback((ruleData: Record<string, unknown>) => {
    setAssociations((current) => applyRulePromotedEvent(current, ruleData));
  }, []);

  useEffect(() => {
    return () => {
      cancelImportReplay();
      importAbortControllerRef.current?.abort();
      importReplaySelectionRef.current = null;
      importReplayRunIdRef.current = null;
    };
  }, [cancelImportReplay]);

  return {
    activeRepo,
    activeRepoId,
    activeSelection,
    lastSelection,
    events,
    phase,
    error,
    storageMode,
    graph,
    graphLoading,
    graphError,
    consolidationRepoId,
    distributionRepoId,
    visibleNodeIds,
    visibleConsolidationNodeIds,
    associations,
    crossSelection,
    setPhase,
    setError,
    setConsolidationRepoId,
    setDistributionRepoId,
    setVisibleConsolidationNodeIds,
    setCrossSelection,
    startImport,
    refreshGraph,
    applyRuleAssociation,
  };
}
