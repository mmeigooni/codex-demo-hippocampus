"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BrainSceneClient } from "@/components/brain/BrainSceneClient";
import type {
  BrainEdgeModel,
  BrainNodeModel,
  CrossSelectionState,
  PositionedBrainNode,
} from "@/components/brain/types";
import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { NarrativeFeed } from "@/components/feed/NarrativeFeed";
import { RepoSelector } from "@/components/onboarding/RepoSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConsolidationStream } from "@/hooks/useConsolidationStream";
import { useConsolidationVisuals } from "@/hooks/useConsolidationVisuals";
import { useDistributionStream } from "@/hooks/useDistributionStream";
import { useTheatricalScheduler } from "@/hooks/useTheatricalScheduler";
import type { ConsolidationEvent } from "@/lib/codex/types";
import { applyRulePromotedEvent, type AssociationMap } from "@/lib/feed/association-state";
import { partitionIntoNarrative, patternDisplayLabel } from "@/lib/feed/narrative-partition";
import { activityEventMatchesNodeId, graphNodeIdFromConsolidationEvent } from "@/lib/feed/cross-selection";
import { toImportActivityEvent } from "@/lib/feed/import-activity";
import {
  resolveImportStreamMode,
  stripReplayManifest,
  type ImportStreamMode,
} from "@/lib/feed/import-stream-mode";
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

export interface SelectedNarrative {
  whatHappened?: string;
  thePattern?: string;
  theFix?: string;
  whyItMatters?: string;
  ruleConfidence?: number;
  ruleEpisodeCount?: number;
}

interface ResolveSelectedNarrativeInput {
  activityEvents: ActivityEventView[];
  selectedNodeId: string | null;
  selectedNodeType: BrainNodeModel["type"] | null;
  selectedPatternKey: string | null;
}

const EMPTY_GRAPH: GraphPayload = {
  nodes: [],
  edges: [],
  stats: {
    episodeCount: 0,
    ruleCount: 0,
  },
};

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

function nonEmptyText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function resolvePatternFromRaw(raw: Record<string, unknown>) {
  const nestedEpisode = raw.episode;
  if (nestedEpisode && typeof nestedEpisode === "object") {
    const nestedPattern = nonEmptyText((nestedEpisode as Record<string, unknown>).the_pattern);
    if (nestedPattern) {
      return nestedPattern;
    }
  }

  const topLevelPattern = nonEmptyText(raw.the_pattern);
  if (topLevelPattern) {
    return topLevelPattern;
  }

  return null;
}

function hasNarrativeContent(narrative: SelectedNarrative) {
  return (
    nonEmptyText(narrative.whatHappened) !== null ||
    nonEmptyText(narrative.thePattern) !== null ||
    nonEmptyText(narrative.theFix) !== null ||
    nonEmptyText(narrative.whyItMatters) !== null ||
    (typeof narrative.ruleConfidence === "number" && Number.isFinite(narrative.ruleConfidence)) ||
    (typeof narrative.ruleEpisodeCount === "number" && Number.isFinite(narrative.ruleEpisodeCount))
  );
}

function latestMatchingEpisodeEvent(activityEvents: ActivityEventView[], selectedNodeId: string) {
  for (let index = activityEvents.length - 1; index >= 0; index -= 1) {
    const event = activityEvents[index];
    if (!event) {
      continue;
    }

    if (event.type === "episode_created" && activityEventMatchesNodeId(event, selectedNodeId)) {
      return event;
    }

    if (Array.isArray(event.groupedEpisodes) && event.groupedEpisodes.length > 0) {
      for (let nestedIndex = event.groupedEpisodes.length - 1; nestedIndex >= 0; nestedIndex -= 1) {
        const nestedEvent = event.groupedEpisodes[nestedIndex];
        if (!nestedEvent || nestedEvent.type !== "episode_created") {
          continue;
        }

        if (activityEventMatchesNodeId(nestedEvent, selectedNodeId)) {
          return nestedEvent;
        }
      }
    }
  }

  return null;
}

function latestMatchingRuleEvent(activityEvents: ActivityEventView[], selectedNodeId: string) {
  for (let index = activityEvents.length - 1; index >= 0; index -= 1) {
    const event = activityEvents[index];
    if (!event || event.type !== "rule_promoted") {
      continue;
    }

    if (activityEventMatchesNodeId(event, selectedNodeId)) {
      return event;
    }
  }

  return null;
}

function resolveRuleEpisodeCount(ruleEvent: ActivityEventView | null) {
  if (!ruleEvent) {
    return null;
  }

  const explicitCount = numberFromUnknown(ruleEvent.raw.episode_count);
  if (explicitCount !== null) {
    return explicitCount;
  }

  if (Array.isArray(ruleEvent.raw.source_episode_ids)) {
    return ruleEvent.raw.source_episode_ids.length;
  }

  return null;
}

export function resolveSelectedNarrative({
  activityEvents,
  selectedNodeId,
  selectedNodeType,
  selectedPatternKey,
}: ResolveSelectedNarrativeInput): SelectedNarrative | null {
  if (!selectedNodeId) {
    return null;
  }

  const isRuleNode = selectedNodeType === "rule" || selectedNodeId.startsWith("rule-");
  if (isRuleNode) {
    const matchingRuleEvent = latestMatchingRuleEvent(activityEvents, selectedNodeId);
    const patternFromNode = nonEmptyText(selectedPatternKey);
    const patternFromRuleEvent = nonEmptyText(matchingRuleEvent?.raw.rule_key);
    const resolvedPatternKey = patternFromNode ?? patternFromRuleEvent;
    const patternLabel = resolvedPatternKey ? patternDisplayLabel(resolvedPatternKey) : undefined;

    const ruleConfidence = numberFromUnknown(matchingRuleEvent?.raw.confidence) ?? undefined;
    const ruleEpisodeCount = resolveRuleEpisodeCount(matchingRuleEvent) ?? undefined;
    const whyItMatters = nonEmptyText(matchingRuleEvent?.raw.description) ?? undefined;
    const whatHappened =
      typeof ruleEpisodeCount === "number"
        ? `${ruleEpisodeCount} observation${ruleEpisodeCount === 1 ? "" : "s"} converged into this rule.`
        : undefined;

    const narrative: SelectedNarrative = {
      whatHappened,
      thePattern: patternLabel,
      whyItMatters,
      ruleConfidence,
      ruleEpisodeCount,
    };

    return hasNarrativeContent(narrative) ? narrative : null;
  }

  const episodeEvent = latestMatchingEpisodeEvent(activityEvents, selectedNodeId);
  if (!episodeEvent) {
    return null;
  }

  const subtitlePattern = nonEmptyText(episodeEvent.subtitle);
  const rawPattern = resolvePatternFromRaw(episodeEvent.raw);
  const resolvedPattern = subtitlePattern ?? (rawPattern ? patternDisplayLabel(rawPattern) : undefined);

  const narrative: SelectedNarrative = {
    whatHappened: nonEmptyText(episodeEvent.whatHappened) ?? undefined,
    thePattern: resolvedPattern,
    theFix: nonEmptyText(episodeEvent.theFix) ?? undefined,
    whyItMatters: nonEmptyText(episodeEvent.whyItMatters) ?? undefined,
  };

  return hasNarrativeContent(narrative) ? narrative : null;
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

function consolidationEventToActivity(event: ConsolidationEvent, index: number): ActivityEventView | null {
  const prefix = `consolidation-${event.type}-${index}`;
  const data = (event.data ?? {}) as Record<string, unknown>;

  if (
    event.type === "replay_manifest" ||
    event.type === "reasoning_start" ||
    event.type === "reasoning_delta" ||
    event.type === "reasoning_complete" ||
    event.type === "response_start" ||
    event.type === "response_delta"
  ) {
    return null;
  }

  if (event.type === "consolidation_start") {
    return {
      id: prefix,
      type: event.type,
      title: `Analyzing ${String(data.repo_full_name ?? "repository")}...`,
      subtitle: `${String(data.episode_count ?? 0)} episodes, ${String(data.existing_rule_count ?? 0)} existing rules`,
      variant: "consolidation",
      raw: data,
    };
  }

  if (event.type === "pattern_detected") {
    return {
      id: prefix,
      type: event.type,
      title: `Pattern found: ${String(data.name ?? "unknown")}`,
      subtitle: String(data.summary ?? "Pattern summary unavailable"),
      variant: "consolidation",
      raw: data,
    };
  }

  if (event.type === "rule_promoted") {
    return {
      id: prefix,
      type: event.type,
      title: `Insight: ${String(data.title ?? "Untitled rule")}`,
      subtitle: String(data.description ?? "Rule promoted"),
      triggers: Array.isArray(data.triggers) ? (data.triggers as string[]) : [],
      graphNodeId: graphNodeIdFromConsolidationEvent(event) ?? undefined,
      variant: "consolidation",
      raw: data,
    };
  }

  if (event.type === "salience_updated") {
    return {
      id: prefix,
      type: event.type,
      title: `Salience updated for episode ${String(data.episode_id ?? "unknown")}`,
      subtitle: String(data.reason ?? "Salience updated"),
      salience: Number(data.salience_score ?? 0),
      graphNodeId: graphNodeIdFromConsolidationEvent(event) ?? undefined,
      variant: "consolidation",
      raw: data,
    };
  }

  if (event.type === "contradiction_found") {
    return {
      id: prefix,
      type: event.type,
      title: "Tension found",
      subtitle: String(data.reason ?? "Incompatible episode pair found"),
      variant: "consolidation",
      raw: data,
    };
  }

  if (event.type === "consolidation_complete") {
    const summary = (data.summary ?? {}) as Record<string, unknown>;
    const counts = (summary.counts ?? {}) as Record<string, unknown>;
    return {
      id: prefix,
      type: event.type,
      title: "Analysis complete",
      subtitle: `${String(counts.rules_promoted ?? 0)} rules promoted, ${String(counts.salience_updates ?? 0)} salience updates`,
      variant: "consolidation",
      raw: data,
    };
  }

  if (event.type === "consolidation_error") {
    return {
      id: prefix,
      type: event.type,
      title: "Consolidation failed",
      subtitle: String(data.message ?? "Unexpected consolidation error"),
      variant: "consolidation",
      raw: data,
    };
  }

  return null;
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
  const [consolidationRepoId, setConsolidationRepoId] = useState<string | null>(null);
  const [distributionRepoId, setDistributionRepoId] = useState<string | null>(null);
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string> | null>(null);
  const [visibleConsolidationNodeIds, setVisibleConsolidationNodeIds] = useState<Set<string> | null>(null);
  const [associations, setAssociations] = useState<AssociationMap>(new Map());
  const [crossSelection, setCrossSelection] = useState<CrossSelectionState>({
    selectedNodeId: null,
    source: "feed",
  });
  const graphRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedConsolidationEventCountRef = useRef(0);
  const importReplaySelectionRef = useRef<ImportRepoRequest | null>(null);
  const importReplayRunIdRef = useRef<number | null>(null);
  const importRunIdRef = useRef(0);
  const importAbortControllerRef = useRef<AbortController | null>(null);
  const { visualState: consolidationVisuals, processConsolidationEvent } = useConsolidationVisuals();

  const {
    runConsolidation,
    events: consolidationEvents,
    progress: consolidationProgress,
    isRunning: isConsolidating,
    error: consolidationError,
    summary: consolidationSummary,
    reasoningText,
    isReasoningActive,
  } = useConsolidationStream();

  const {
    runDistribution,
    isDistributing,
    distributionResult,
    distributionPhase,
  } = useDistributionStream();

  const activityEvents = useMemo(() => {
    const importActivityEvents = events
      .map((event, index) => toImportActivityEvent(event, index))
      .filter((event): event is ActivityEventView => event !== null);
    const consolidationActivityEvents = consolidationEvents
      .map((event, index) => consolidationEventToActivity(event, index))
      .filter((event): event is ActivityEventView => event !== null);

    const mergedEvents = [...importActivityEvents, ...consolidationActivityEvents];

    if (isReasoningActive || reasoningText) {
      mergedEvents.push({
        id: "reasoning-live",
        type: "reasoning",
        title: "Model reasoning",
        variant: "reasoning",
        reasoningText,
        isStreamingReasoning: isReasoningActive,
        raw: { text: reasoningText },
      });
    }

    if (distributionPhase && isDistributing) {
      mergedEvents.push({
        id: `distribution-phase-${distributionPhase}`,
        type: "distribution_progress",
        title: distributionPhase,
        variant: "distribution",
        raw: { phase: distributionPhase },
      });
    }

    if (distributionResult) {
      mergedEvents.push({
        id: `distribution-result-${distributionResult.prNumber ?? distributionResult.reason ?? "complete"}`,
        type: distributionResult.error ? "distribution_error" : "distribution_complete",
        title: distributionResult.error
          ? "Distribution failed"
          : distributionResult.skippedPr
            ? "Distribution preview generated"
            : "Distribution complete",
        subtitle: distributionResult.error
          ? distributionResult.error
          : distributionResult.prUrl
            ? `PR #${distributionResult.prNumber ?? "?"} is ready`
            : distributionResult.reason,
        variant: "distribution",
        raw: distributionResult as unknown as Record<string, unknown>,
      });
    }

    if (phase === "importing" && mergedEvents.length === 0 && activeRepo) {
      return [
        {
          id: `bootstrap-${activeRepo}`,
          type: "import_bootstrap",
          title: `Preparing ${activeRepo}`,
          subtitle: "Verifying repository access and loading merged pull requests...",
          variant: "import",
          raw: { repo: activeRepo },
        } satisfies ActivityEventView,
      ];
    }

    return mergedEvents;
  }, [
    activeRepo,
    consolidationEvents,
    distributionPhase,
    distributionResult,
    events,
    isDistributing,
    isReasoningActive,
    phase,
    reasoningText,
  ]);

  const narrativeSections = useMemo(() => partitionIntoNarrative(activityEvents, associations), [activityEvents, associations]);
  const latestImportStatus = useMemo(() => {
    if (phase !== "importing") {
      return null;
    }

    const latestEvent = events[events.length - 1];
    if (!latestEvent) {
      return null;
    }

    const data = latestEvent.data as Record<string, unknown>;

    if (latestEvent.type === "encoding_start") {
      const title = typeof data.title === "string" && data.title.trim().length > 0 ? data.title.trim() : "Untitled PR";
      const truncatedTitle = title.length > 60 ? `${title.slice(0, 57)}...` : title;
      return `Scanning PR #${String(data.pr_number ?? "?")}: ${truncatedTitle}`;
    }

    if (String(latestEvent.type) === "snippets_extracted") {
      return `Extracted ${String(data.snippet_count ?? "?")} snippets from ${String(data.file_count ?? "?")} files`;
    }

    if (latestEvent.type === "episode_created") {
      const episode = data.episode && typeof data.episode === "object" ? (data.episode as Record<string, unknown>) : null;
      const pattern = typeof episode?.the_pattern === "string" ? episode.the_pattern : null;
      const title = typeof episode?.title === "string" && episode.title.trim().length > 0 ? episode.title.trim() : "observation";
      return pattern ? `Encoded pattern: ${pattern}` : `Encoded: ${title}`;
    }

    return null;
  }, [events, phase]);

  const statusText = useMemo(() => {
    const activeError = error ?? consolidationError ?? distributionResult?.error ?? null;

    if (phase === "importing") {
      if (events.length === 0) {
        return "Preparing import. Verifying repository access and scanning merged pull requests.";
      }

      return "Reading code reviews...";
    }

    if (phase === "ready") {
      const completeEvent = events.findLast((event) => event.type === "complete");
      const total = Number(completeEvent?.data.total ?? 0);
      const failed = Number(completeEvent?.data.failed ?? 0);
      const skipped = Number(completeEvent?.data.skipped ?? 0);

      if (total === 0 && skipped > 0 && failed === 0) {
        return `Finished reading. ${skipped} observations already captured.`;
      }

      if (failed > 0 && skipped > 0) {
        return `Finished reading. ${total} observations captured (${skipped} already imported, ${failed} failed).`;
      }

      if (failed > 0) {
        return `Finished reading. ${total} observations captured (${failed} failed).`;
      }

      if (skipped > 0) {
        return `Finished reading. ${total} observations captured (${skipped} already imported).`;
      }

      return `Finished reading. ${total} observations captured.`;
    }

    if (phase === "consolidating") {
      return "Analyzing patterns across observations...";
    }

    if (phase === "consolidated") {
      return "Analysis complete. Insights ready.";
    }

    if (phase === "distributing") {
      return "Distributing to repo...";
    }

    if (phase === "distributed") {
      if (distributionResult?.error) {
        return distributionResult.error;
      }

      if (distributionResult?.prUrl) {
        return `Distribution complete. PR #${distributionResult.prNumber ?? "?"} created.`;
      }

      if (distributionResult?.skippedPr) {
        return "Distribution preview generated. Open a PR manually.";
      }

      return "Distribution complete.";
    }

    if (phase === "error") {
      return activeError ?? "Workflow encountered an error.";
    }

    return "Select a repository to begin.";
  }, [consolidationError, distributionResult, error, events, phase]);

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

      if (runId !== undefined && importRunIdRef.current !== runId) {
        return;
      }
      setEvents((current) => [...current, ...visibleEvents]);

      if (visibleEvents.some((event) => event.type === "encoding_error")) {
        if (runId !== undefined && importRunIdRef.current !== runId) {
          return;
        }
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
          if (runId !== undefined && importRunIdRef.current !== runId) {
            return;
          }
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
        const completeData = completeEvent?.data as Record<string, unknown> | undefined;
        if (typeof completeData?.repo_id === "string") {
          if (runId !== undefined && importRunIdRef.current !== runId) {
            return;
          }
          setActiveRepoId(completeData.repo_id);
        }

        if (replayMode) {
          if (runId !== undefined && importRunIdRef.current !== runId) {
            return;
          }
          setVisibleNodeIds(null);
        }

        if (runId !== undefined && importRunIdRef.current !== runId) {
          return;
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

  const startImport = async (repoSelection: ImportRepoRequest) => {
    importAbortControllerRef.current?.abort();
    const controller = new AbortController();
    importAbortControllerRef.current = controller;

    const runId = importRunIdRef.current + 1;
    importRunIdRef.current = runId;

    setLastSelection(repoSelection);
    setActiveSelection(repoSelection);

    const fullName = `${repoSelection.owner}/${repoSelection.repo}`;
    setActiveRepo(fullName);
    setActiveRepoId(null);
    setConsolidationRepoId(null);
    setDistributionRepoId(null);
    processedConsolidationEventCountRef.current = 0;
    if (graphRefreshDebounceRef.current) {
      clearTimeout(graphRefreshDebounceRef.current);
      graphRefreshDebounceRef.current = null;
    }
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
        const parsed = extractEventsFromBuffer(buffer);
        buffer = parsed.remainder;

        if (parsed.events.length > 0) {
          const chunkEvents = parsed.events as ImportEvent[];
          const nextMode = resolveImportStreamMode(streamMode, chunkEvents);

          if (streamMode === "unknown" && nextMode === "live") {
            if (importRunIdRef.current !== runId) {
              return;
            }
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
      }

      if (streamMode === "replay") {
        if (replayEvents.length === 0) {
          if (importRunIdRef.current !== runId) {
            return;
          }
          setVisibleNodeIds(null);
          setPhase((phaseCurrent) => moveForwardPhase(phaseCurrent, "ready"));
        } else {
          // Load graph data BEFORE starting the theatrical scheduler so that
          // displayNodes can filter graph.nodes as visibleNodeIds grows.
          await refreshGraph(repoSelection, { guardRunId: runId });
          if (importRunIdRef.current !== runId) {
            return;
          }
          importReplaySelectionRef.current = repoSelection;
          importReplayRunIdRef.current = runId;
          enqueueImportReplay(replayEvents);
        }
      } else {
        if (bufferedUnknownEvents.length > 0) {
          applyImportEvents(bufferedUnknownEvents, repoSelection, false, runId);
        }
        await refreshGraph(repoSelection, { guardRunId: runId });
        if (importRunIdRef.current !== runId) {
          return;
        }
        setPhase((phaseCurrent) => moveForwardPhase(phaseCurrent, "ready"));
      }
    } catch (importError) {
      if (importError instanceof Error && importError.name === "AbortError") {
        return;
      }
      if (importRunIdRef.current !== runId) {
        return;
      }
      const message = importError instanceof Error ? importError.message : "Import failed";
      setError(message);
      setPhase("error");
    }
  };

  const handleRunConsolidation = async () => {
    if (!activeRepoId) {
      return;
    }

    setError(null);
    setConsolidationRepoId(activeRepoId);
    setDistributionRepoId(null);
    setVisibleConsolidationNodeIds(new Set());
    setPhase("consolidating");
    await runConsolidation(activeRepoId);
  };

  const handleRunDistribution = async () => {
    if (!activeRepoId || !consolidationSummary?.pack) {
      return;
    }

    setError(null);
    setDistributionRepoId(activeRepoId);
    setPhase("distributing");
    await runDistribution(activeRepoId);
  };

  useEffect(() => {
    if (!consolidationRepoId || consolidationRepoId !== activeRepoId) {
      return;
    }

    if (isConsolidating) {
      setPhase((current) => moveForwardPhase(current, "consolidating"));
      return;
    }

    if (consolidationSummary) {
      setPhase((current) => moveForwardPhase(current, "consolidated"));
    }
  }, [activeRepoId, consolidationRepoId, consolidationSummary, isConsolidating]);

  useEffect(() => {
    if (!distributionRepoId || distributionRepoId !== activeRepoId) {
      return;
    }

    if (isDistributing) {
      setPhase((current) => moveForwardPhase(current, "distributing"));
      return;
    }

    if (distributionResult && !distributionResult.error) {
      setPhase((current) => moveForwardPhase(current, "distributed"));
    }
  }, [activeRepoId, distributionRepoId, distributionResult, isDistributing]);

  useEffect(() => {
    if (!consolidationError) {
      return;
    }

    setError(consolidationError);
    setPhase("error");
  }, [consolidationError]);

  useEffect(() => {
    if (!distributionResult?.error) {
      return;
    }

    setError(distributionResult.error);
    setPhase("error");
  }, [distributionResult]);

  useEffect(() => {
    if (!activeSelection || !activeRepoId || consolidationRepoId !== activeRepoId) {
      return;
    }

    const lastProcessed = processedConsolidationEventCountRef.current;
    if (consolidationEvents.length <= lastProcessed) {
      return;
    }

    const pendingEvents = consolidationEvents.slice(lastProcessed);
    processedConsolidationEventCountRef.current = consolidationEvents.length;

    let shouldDebounceRefresh = false;
    let shouldRefreshImmediately = false;
    const revealedRuleNodeIds: string[] = [];
    let shouldRevealAllRules = false;

    for (const event of pendingEvents) {
      processConsolidationEvent(event);

      if (event.type === "rule_promoted" || event.type === "salience_updated") {
        shouldDebounceRefresh = true;
      }

      if (event.type === "rule_promoted") {
        const eventData = event.data as Record<string, unknown>;
        setAssociations((current) => applyRulePromotedEvent(current, eventData));
        const ruleId = eventData.rule_id;
        if (typeof ruleId === "string" && ruleId.length > 0) {
          revealedRuleNodeIds.push(`rule-${ruleId}`);
        }
      }

      if (event.type === "consolidation_complete") {
        shouldRefreshImmediately = true;
        shouldRevealAllRules = true;
      }
    }

    if (revealedRuleNodeIds.length > 0) {
      setVisibleConsolidationNodeIds((current) => {
        if (current === null) {
          return current;
        }

        const next = new Set(current);
        for (const nodeId of revealedRuleNodeIds) {
          next.add(nodeId);
        }

        return next;
      });
    }

    if (shouldRevealAllRules) {
      setVisibleConsolidationNodeIds(null);
    }

    if (shouldDebounceRefresh) {
      if (graphRefreshDebounceRef.current) {
        clearTimeout(graphRefreshDebounceRef.current);
      }

      const selectionSnapshot = activeSelection;
      graphRefreshDebounceRef.current = setTimeout(() => {
        graphRefreshDebounceRef.current = null;
        void refreshGraph(selectionSnapshot);
      }, 2000);
    }

    if (shouldRefreshImmediately) {
      if (graphRefreshDebounceRef.current) {
        clearTimeout(graphRefreshDebounceRef.current);
        graphRefreshDebounceRef.current = null;
      }

      void refreshGraph(activeSelection);
    }
  }, [
    activeRepoId,
    activeSelection,
    consolidationEvents,
    consolidationRepoId,
    processConsolidationEvent,
    refreshGraph,
  ]);

  useEffect(() => {
    return () => {
      if (graphRefreshDebounceRef.current) {
        clearTimeout(graphRefreshDebounceRef.current);
      }

      cancelImportReplay();
      importAbortControllerRef.current?.abort();
      importReplaySelectionRef.current = null;
      importReplayRunIdRef.current = null;
    };
  }, [cancelImportReplay]);

  const displayNodes = useMemo(() => {
    let nodes = visibleNodeIds
      ? graph.nodes.filter((node) => visibleNodeIds.has(node.id))
      : graph.nodes;

    if (PHASE_ORDER[phase] < PHASE_ORDER.consolidating) {
      nodes = nodes.filter((node) => node.type !== "rule");
    } else if (visibleConsolidationNodeIds) {
      nodes = nodes.filter(
        (node) => node.type !== "rule" || visibleConsolidationNodeIds.has(node.id),
      );
    }

    return nodes;
  }, [graph.nodes, phase, visibleConsolidationNodeIds, visibleNodeIds]);

  const displayEdges = useMemo(() => {
    let edges = visibleNodeIds
      ? graph.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      : graph.edges;

    if (PHASE_ORDER[phase] < PHASE_ORDER.consolidating) {
      const ruleNodeIds = new Set(graph.nodes.filter((node) => node.type === "rule").map((node) => node.id));
      edges = edges.filter((edge) => !ruleNodeIds.has(edge.source) && !ruleNodeIds.has(edge.target));
    } else if (visibleConsolidationNodeIds) {
      const hiddenRuleNodeIds = new Set(
        graph.nodes
          .filter((node) => node.type === "rule" && !visibleConsolidationNodeIds.has(node.id))
          .map((node) => node.id),
      );
      edges = edges.filter((edge) => !hiddenRuleNodeIds.has(edge.source) && !hiddenRuleNodeIds.has(edge.target));
    }

    return edges;
  }, [graph.edges, graph.nodes, phase, visibleConsolidationNodeIds, visibleNodeIds]);

  const selectedGraphNode = useMemo(() => {
    if (!crossSelection.selectedNodeId) {
      return null;
    }

    return graph.nodes.find((node) => node.id === crossSelection.selectedNodeId) ?? null;
  }, [crossSelection.selectedNodeId, graph.nodes]);

  const selectedNarrative = useMemo(
    () =>
      resolveSelectedNarrative({
        activityEvents,
        selectedNodeId: crossSelection.selectedNodeId,
        selectedNodeType: selectedGraphNode?.type ?? null,
        selectedPatternKey: selectedGraphNode?.patternKey ?? null,
      }),
    [activityEvents, crossSelection.selectedNodeId, selectedGraphNode?.patternKey, selectedGraphNode?.type],
  );

  const noConsolidatedRules = activeSelection && !graphLoading && graph.stats.ruleCount === 0;

  const handleFeedSelection = useCallback((event: ActivityEventView) => {
    const graphNodeId = event.graphNodeId;
    if (!graphNodeId) {
      return;
    }

    setCrossSelection((current) => {
      if (current.selectedNodeId === graphNodeId && current.source === "feed") {
        return {
          selectedNodeId: null,
          source: "feed",
        };
      }

      return {
        selectedNodeId: graphNodeId,
        source: "feed",
      };
    });
  }, []);

  const handleGraphSelectionCommit = useCallback((node: PositionedBrainNode | null) => {
    setCrossSelection({
      selectedNodeId: node?.id ?? null,
      source: "graph",
    });
  }, []);

  return (
    <div className="space-y-6">
      <RepoSelector
        demoRepoFullName={demoRepoFullName}
        onSelectRepo={startImport}
        disabled={phase === "importing" || phase === "consolidating" || phase === "distributing"}
        collapsed={PHASE_ORDER[phase] >= PHASE_ORDER.importing && phase !== "error"}
        activeRepoName={activeRepo ?? undefined}
      />

      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-zinc-100">Memory Timeline</CardTitle>
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
          <div className="flex flex-wrap items-center gap-2">
            {PHASE_ORDER[phase] >= PHASE_ORDER.ready ? (
              <Button
                onClick={handleRunConsolidation}
                disabled={isConsolidating || isDistributing || !activeRepoId}
              >
                {isConsolidating ? "Running sleep cycle..." : "Run Sleep Cycle"}
              </Button>
            ) : null}
            {PHASE_ORDER[phase] >= PHASE_ORDER.consolidated ? (
              <Button
                onClick={handleRunDistribution}
                disabled={isConsolidating || isDistributing || !consolidationSummary?.pack}
                variant="secondary"
              >
                {isDistributing
                  ? "Distributing..."
                  : distributionResult && !distributionResult.error
                    ? "Distributed"
                    : "Distribute to repo"}
              </Button>
            ) : null}
          </div>
          {isConsolidating ? (
            <p className="text-xs text-zinc-400">
              Patterns: {consolidationProgress.patterns} · Rules: {consolidationProgress.rules} · Salience:{" "}
              {consolidationProgress.salienceUpdates} · Contradictions: {consolidationProgress.contradictions}
            </p>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
            <div className="max-h-[540px] overflow-hidden px-1">
              <NarrativeFeed
                sections={narrativeSections}
                maxItems={14}
                importStatusText={latestImportStatus}
                selectedNodeId={crossSelection.selectedNodeId}
                selectionSource={crossSelection.selectedNodeId ? crossSelection.source : null}
                onSelectEvent={handleFeedSelection}
              />
            </div>
            <BrainSceneClient
              nodes={displayNodes}
              edges={displayEdges}
              layoutNodes={graph.nodes}
              layoutEdges={graph.edges}
              consolidationVisuals={consolidationVisuals}
              selectedNarrative={selectedNarrative}
              externalSelectedNodeId={crossSelection.selectedNodeId}
              onNodeSelectionCommit={handleGraphSelectionCommit}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
