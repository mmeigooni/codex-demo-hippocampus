"use client";

import type { DreamPhase } from "@/components/sleep-cycle/DreamState";
import { DreamStateMini } from "@/components/onboarding/DreamStateMini";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardPhase =
  | "idle"
  | "importing"
  | "ready"
  | "consolidating"
  | "consolidated"
  | "distributing"
  | "distributed"
  | "error";

interface ConsolidationCTAProps {
  phase: DashboardPhase;
  dreamPhase: DreamPhase;
  onRun: () => Promise<void> | void;
  isRunning: boolean;
  progress: {
    patterns: number;
    rules: number;
    salienceUpdates: number;
    contradictions: number;
  };
  reasoningText: string;
  isReasoningActive: boolean;
  error?: string | null;
}

export function ConsolidationCTA({
  phase,
  dreamPhase,
  onRun,
  isRunning,
  progress,
  reasoningText,
  isReasoningActive,
  error = null,
}: ConsolidationCTAProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader>
        <CardTitle className="text-zinc-100">Sleep Cycle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {phase === "ready" || phase === "error" ? (
          <Button onClick={onRun} disabled={isRunning}>
            {isRunning ? "Running sleep cycle..." : "Run Sleep Cycle"}
          </Button>
        ) : null}

        {isRunning ? (
          <DreamStateMini
            phase={dreamPhase}
            patterns={progress.patterns}
            rules={progress.rules}
            salienceUpdates={progress.salienceUpdates}
            contradictions={progress.contradictions}
          />
        ) : null}

        {isRunning ? (
          <p className="text-xs text-zinc-400">
            {isReasoningActive
              ? "Reasoning stream is active."
              : reasoningText
                ? "Reasoning stream complete."
                : "Consolidation stream is active."}
          </p>
        ) : null}

        {!isRunning && phase === "consolidated" ? (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            Consolidation complete.
          </p>
        ) : null}

        {error && !isRunning ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
