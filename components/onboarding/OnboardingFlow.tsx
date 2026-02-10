"use client";

import { useCallback, useMemo } from "react";

import { BrainSceneClient } from "@/components/brain/BrainSceneClient";
import type { PositionedBrainNode } from "@/components/brain/types";
import type { ActivityEventView } from "@/components/feed/ActivityCard";
import {
  buildActivityEvents,
  deriveStatusText,
  latestImportStatusText,
  PHASE_ORDER,
  resolveSelectedNarrative as resolveSelectedNarrativeFromActivity,
} from "@/components/onboarding/onboarding-activity";
import { NarrativeFeed } from "@/components/feed/NarrativeFeed";
import { RepoSelector } from "@/components/onboarding/RepoSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOnboardingConsolidation } from "@/hooks/useOnboardingConsolidation";
import { useOnboardingDistribution } from "@/hooks/useOnboardingDistribution";
import { useOnboardingImport } from "@/hooks/useOnboardingImport";
import { partitionIntoNarrative } from "@/lib/feed/narrative-partition";

export { resolveSelectedNarrative } from "@/components/onboarding/onboarding-activity";

interface OnboardingFlowProps {
  demoRepoFullName: string;
}

export function OnboardingFlow({ demoRepoFullName }: OnboardingFlowProps) {
  const onboardingImport = useOnboardingImport();

  const {
    consolidationVisuals,
    consolidationEvents,
    consolidationProgress,
    isConsolidating,
    consolidationError,
    consolidationSummary,
    reasoningText,
    isReasoningActive,
    handleRunConsolidation,
  } = useOnboardingConsolidation({
    activeRepoId: onboardingImport.activeRepoId,
    activeSelection: onboardingImport.activeSelection,
    consolidationRepoId: onboardingImport.consolidationRepoId,
    setConsolidationRepoId: onboardingImport.setConsolidationRepoId,
    setDistributionRepoId: onboardingImport.setDistributionRepoId,
    setPhase: onboardingImport.setPhase,
    setError: onboardingImport.setError,
    setVisibleConsolidationNodeIds: onboardingImport.setVisibleConsolidationNodeIds,
    applyRuleAssociation: onboardingImport.applyRuleAssociation,
    refreshGraph: onboardingImport.refreshGraph,
  });

  const { handleRunDistribution, isDistributing, distributionResult, distributionPhase } =
    useOnboardingDistribution({
      activeRepoId: onboardingImport.activeRepoId,
      distributionRepoId: onboardingImport.distributionRepoId,
      setDistributionRepoId: onboardingImport.setDistributionRepoId,
      consolidationSummary,
      setPhase: onboardingImport.setPhase,
      setError: onboardingImport.setError,
    });

  const activityEvents = useMemo(
    () =>
      buildActivityEvents({
        importEvents: onboardingImport.events,
        consolidationEvents,
        reasoningText,
        isReasoningActive,
        distributionPhase,
        isDistributing,
        distributionResult,
        phase: onboardingImport.phase,
        activeRepo: onboardingImport.activeRepo,
      }),
    [
      consolidationEvents,
      distributionPhase,
      distributionResult,
      isDistributing,
      isReasoningActive,
      onboardingImport.activeRepo,
      onboardingImport.events,
      onboardingImport.phase,
      reasoningText,
    ],
  );

  const narrativeSections = useMemo(
    () => partitionIntoNarrative(activityEvents, onboardingImport.associations),
    [activityEvents, onboardingImport.associations],
  );

  const latestImportStatus = useMemo(
    () => latestImportStatusText(onboardingImport.events, onboardingImport.phase),
    [onboardingImport.events, onboardingImport.phase],
  );

  const statusText = useMemo(
    () =>
      deriveStatusText({
        phase: onboardingImport.phase,
        importEvents: onboardingImport.events,
        error: onboardingImport.error,
        consolidationError,
        distributionResult,
      }),
    [consolidationError, distributionResult, onboardingImport.error, onboardingImport.events, onboardingImport.phase],
  );

  const displayNodes = useMemo(() => {
    let nodes = onboardingImport.visibleNodeIds
      ? onboardingImport.graph.nodes.filter((node) => onboardingImport.visibleNodeIds?.has(node.id))
      : onboardingImport.graph.nodes;

    if (PHASE_ORDER[onboardingImport.phase] < PHASE_ORDER.consolidating) {
      nodes = nodes.filter((node) => node.type !== "rule");
    } else if (onboardingImport.visibleConsolidationNodeIds) {
      nodes = nodes.filter(
        (node) => node.type !== "rule" || onboardingImport.visibleConsolidationNodeIds?.has(node.id),
      );
    }

    return nodes;
  }, [
    onboardingImport.graph.nodes,
    onboardingImport.phase,
    onboardingImport.visibleConsolidationNodeIds,
    onboardingImport.visibleNodeIds,
  ]);

  const displayEdges = useMemo(() => {
    let edges = onboardingImport.visibleNodeIds
      ? onboardingImport.graph.edges.filter(
          (edge) => onboardingImport.visibleNodeIds?.has(edge.source) && onboardingImport.visibleNodeIds?.has(edge.target),
        )
      : onboardingImport.graph.edges;

    if (PHASE_ORDER[onboardingImport.phase] < PHASE_ORDER.consolidating) {
      const ruleNodeIds = new Set(
        onboardingImport.graph.nodes.filter((node) => node.type === "rule").map((node) => node.id),
      );
      edges = edges.filter((edge) => !ruleNodeIds.has(edge.source) && !ruleNodeIds.has(edge.target));
    } else if (onboardingImport.visibleConsolidationNodeIds) {
      const hiddenRuleNodeIds = new Set(
        onboardingImport.graph.nodes
          .filter((node) => node.type === "rule" && !onboardingImport.visibleConsolidationNodeIds?.has(node.id))
          .map((node) => node.id),
      );
      edges = edges.filter((edge) => !hiddenRuleNodeIds.has(edge.source) && !hiddenRuleNodeIds.has(edge.target));
    }

    return edges;
  }, [
    onboardingImport.graph.edges,
    onboardingImport.graph.nodes,
    onboardingImport.phase,
    onboardingImport.visibleConsolidationNodeIds,
    onboardingImport.visibleNodeIds,
  ]);

  const selectedGraphNode = useMemo(() => {
    if (!onboardingImport.crossSelection.selectedNodeId) {
      return null;
    }

    return onboardingImport.graph.nodes.find((node) => node.id === onboardingImport.crossSelection.selectedNodeId) ?? null;
  }, [onboardingImport.crossSelection.selectedNodeId, onboardingImport.graph.nodes]);

  const selectedNarrative = useMemo(
    () =>
      resolveSelectedNarrativeFromActivity({
        activityEvents,
        selectedNodeId: onboardingImport.crossSelection.selectedNodeId,
        selectedNodeType: selectedGraphNode?.type ?? null,
        selectedPatternKey: selectedGraphNode?.patternKey ?? null,
      }),
    [activityEvents, onboardingImport.crossSelection.selectedNodeId, selectedGraphNode?.patternKey, selectedGraphNode?.type],
  );

  const noConsolidatedRules = onboardingImport.activeSelection && !onboardingImport.graphLoading && onboardingImport.graph.stats.ruleCount === 0;

  const handleFeedSelection = useCallback((event: ActivityEventView) => {
    const graphNodeId = event.graphNodeId;
    if (!graphNodeId) {
      return;
    }

    onboardingImport.setCrossSelection((current) => {
      if (current.selectedNodeId === graphNodeId && current.source === "feed") {
        return { selectedNodeId: null, source: "feed" };
      }

      return { selectedNodeId: graphNodeId, source: "feed" };
    });
  }, [onboardingImport]);

  const handleGraphSelectionCommit = useCallback((node: PositionedBrainNode | null) => {
    onboardingImport.setCrossSelection({
      selectedNodeId: node?.id ?? null,
      source: "graph",
    });
  }, [onboardingImport]);

  return (
    <div className="space-y-6">
      <RepoSelector
        demoRepoFullName={demoRepoFullName}
        onSelectRepo={onboardingImport.startImport}
        disabled={onboardingImport.phase === "importing" || onboardingImport.phase === "consolidating" || onboardingImport.phase === "distributing"}
        collapsed={PHASE_ORDER[onboardingImport.phase] >= PHASE_ORDER.importing && onboardingImport.phase !== "error"}
        activeRepoName={onboardingImport.activeRepo ?? undefined}
      />

      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-zinc-100">Memory Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-300" aria-live="polite">{statusText}</p>
          {onboardingImport.storageMode === "memory-fallback" ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100/90">
              <p>Local fallback mode active: import data is being persisted to in-memory runtime storage because Supabase schema cache is unavailable.</p>
              <p className="mt-1">Repeatability may vary while running in fallback mode.</p>
            </div>
          ) : null}
          {onboardingImport.phase === "error" ? (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
              <p>{onboardingImport.error ?? "Import encountered an error."}</p>
              {onboardingImport.lastSelection ? (
                <button
                  type="button"
                  onClick={() => onboardingImport.startImport(onboardingImport.lastSelection!)}
                  className="mt-2 inline-flex rounded-md border border-rose-300/40 px-3 py-1 text-xs hover:bg-rose-500/20"
                >
                  Retry import
                </button>
              ) : null}
            </div>
          ) : null}
          {onboardingImport.graphError ? (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{onboardingImport.graphError}</div>
          ) : null}
          {onboardingImport.activeRepo ? <p className="text-xs text-zinc-500">Active repo: {onboardingImport.activeRepo}</p> : null}
          {onboardingImport.phase === "importing" && onboardingImport.activeSelection && !onboardingImport.graphLoading ? (
            <p className="text-xs text-cyan-100/80">Existing snapshot: {onboardingImport.graph.stats.episodeCount} episodes loaded while import stream is in progress.</p>
          ) : null}
          {noConsolidatedRules ? <p className="text-xs text-amber-100/90">Run Sleep Cycle to generate rules.</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            {PHASE_ORDER[onboardingImport.phase] >= PHASE_ORDER.ready ? (
              <Button onClick={handleRunConsolidation} disabled={isConsolidating || isDistributing || !onboardingImport.activeRepoId}>
                {isConsolidating ? "Running sleep cycle..." : "Run Sleep Cycle"}
              </Button>
            ) : null}
            {PHASE_ORDER[onboardingImport.phase] >= PHASE_ORDER.consolidated ? (
              <Button onClick={handleRunDistribution} disabled={isConsolidating || isDistributing || !consolidationSummary?.pack} variant="secondary">
                {isDistributing ? "Distributing..." : distributionResult && !distributionResult.error ? "Distributed" : "Distribute to repo"}
              </Button>
            ) : null}
          </div>
          {isConsolidating ? (
            <p className="text-xs text-zinc-400">
              Patterns: {consolidationProgress.patterns} · Rules: {consolidationProgress.rules} · Salience: {consolidationProgress.salienceUpdates} · Contradictions: {consolidationProgress.contradictions}
            </p>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
            <div className="max-h-[540px] overflow-hidden px-1">
              <NarrativeFeed
                sections={narrativeSections}
                maxItems={14}
                importStatusText={latestImportStatus}
                selectedNodeId={onboardingImport.crossSelection.selectedNodeId}
                selectionSource={onboardingImport.crossSelection.selectedNodeId ? onboardingImport.crossSelection.source : null}
                onSelectEvent={handleFeedSelection}
              />
            </div>
            <BrainSceneClient
              nodes={displayNodes}
              edges={displayEdges}
              layoutNodes={onboardingImport.graph.nodes}
              layoutEdges={onboardingImport.graph.edges}
              consolidationVisuals={consolidationVisuals}
              selectedNarrative={selectedNarrative}
              externalSelectedNodeId={onboardingImport.crossSelection.selectedNodeId}
              onNodeSelectionCommit={handleGraphSelectionCommit}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
