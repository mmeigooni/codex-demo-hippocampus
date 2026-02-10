"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { moveForwardPhase, toObject, type OnboardingPhase } from "@/components/onboarding/onboarding-activity";
import { useConsolidationStream } from "@/hooks/useConsolidationStream";
import { useConsolidationVisuals } from "@/hooks/useConsolidationVisuals";
import type { ImportRepoRequest } from "@/lib/github/types";

interface UseOnboardingConsolidationOptions {
  activeRepoId: string | null;
  activeSelection: ImportRepoRequest | null;
  consolidationRepoId: string | null;
  setConsolidationRepoId: (value: string | null) => void;
  setDistributionRepoId: (value: string | null) => void;
  setPhase: Dispatch<SetStateAction<OnboardingPhase>>;
  setError: (value: string | null) => void;
  setVisibleConsolidationNodeIds: Dispatch<SetStateAction<Set<string> | null>>;
  applyRuleAssociation: (ruleData: Record<string, unknown>) => void;
  refreshGraph: (
    repoSelection: ImportRepoRequest,
    options?: {
      guardRunId?: number;
    },
  ) => Promise<void>;
}

export function useOnboardingConsolidation({
  activeRepoId,
  activeSelection,
  consolidationRepoId,
  setConsolidationRepoId,
  setDistributionRepoId,
  setPhase,
  setError,
  setVisibleConsolidationNodeIds,
  applyRuleAssociation,
  refreshGraph,
}: UseOnboardingConsolidationOptions) {
  const processedConsolidationEventCountRef = useRef(0);
  const graphRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const handleRunConsolidation = useCallback(async () => {
    if (!activeRepoId) {
      return;
    }

    setError(null);
    setConsolidationRepoId(activeRepoId);
    setDistributionRepoId(null);
    setVisibleConsolidationNodeIds(new Set());
    setPhase("consolidating");
    await runConsolidation(activeRepoId);
  }, [
    activeRepoId,
    runConsolidation,
    setConsolidationRepoId,
    setDistributionRepoId,
    setError,
    setPhase,
    setVisibleConsolidationNodeIds,
  ]);

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
  }, [activeRepoId, consolidationRepoId, consolidationSummary, isConsolidating, setPhase]);

  useEffect(() => {
    if (!consolidationError) {
      return;
    }

    setError(consolidationError);
    setPhase("error");
  }, [consolidationError, setError, setPhase]);

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
        const eventData = toObject(event.data);
        applyRuleAssociation(eventData);
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
    applyRuleAssociation,
    consolidationEvents,
    consolidationRepoId,
    processConsolidationEvent,
    refreshGraph,
    setVisibleConsolidationNodeIds,
  ]);

  useEffect(() => {
    return () => {
      if (graphRefreshDebounceRef.current) {
        clearTimeout(graphRefreshDebounceRef.current);
      }
    };
  }, []);

  return {
    consolidationVisuals,
    consolidationEvents,
    consolidationProgress,
    isConsolidating,
    consolidationError,
    consolidationSummary,
    reasoningText,
    isReasoningActive,
    handleRunConsolidation,
  };
}
