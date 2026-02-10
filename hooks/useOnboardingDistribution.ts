"use client";

import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";

import { moveForwardPhase, type OnboardingPhase } from "@/components/onboarding/onboarding-activity";
import { useDistributionStream } from "@/hooks/useDistributionStream";

interface UseOnboardingDistributionOptions {
  activeRepoId: string | null;
  distributionRepoId: string | null;
  setDistributionRepoId: (value: string | null) => void;
  consolidationSummary: { pack?: unknown } | null;
  setPhase: Dispatch<SetStateAction<OnboardingPhase>>;
  setError: (value: string | null) => void;
}

export function useOnboardingDistribution({
  activeRepoId,
  distributionRepoId,
  setDistributionRepoId,
  consolidationSummary,
  setPhase,
  setError,
}: UseOnboardingDistributionOptions) {
  const { runDistribution, isDistributing, distributionResult, distributionPhase } = useDistributionStream();

  const handleRunDistribution = useCallback(async () => {
    if (!activeRepoId || !consolidationSummary?.pack) {
      return;
    }

    setError(null);
    setDistributionRepoId(activeRepoId);
    setPhase("distributing");
    await runDistribution(activeRepoId);
  }, [activeRepoId, consolidationSummary?.pack, runDistribution, setDistributionRepoId, setError, setPhase]);

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
  }, [activeRepoId, distributionRepoId, distributionResult, isDistributing, setPhase]);

  useEffect(() => {
    if (!distributionResult?.error) {
      return;
    }

    setError(distributionResult.error);
    setPhase("error");
  }, [distributionResult, setError, setPhase]);

  return {
    handleRunDistribution,
    isDistributing,
    distributionResult,
    distributionPhase,
  };
}
