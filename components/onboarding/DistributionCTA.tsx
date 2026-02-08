"use client";

import type { DistributionResult } from "@/hooks/useDistributionStream";
import { distributionFallbackMessage } from "@/lib/distribution/ui-state";
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

interface DistributionCTAProps {
  phase: DashboardPhase;
  onDistribute: () => Promise<void> | void;
  isDistributing: boolean;
  distributionResult: DistributionResult | null;
  distributionPhase: string | null;
  onCopyMarkdown: () => Promise<void> | void;
  copiedMarkdown: boolean;
}

export function DistributionCTA({
  phase,
  onDistribute,
  isDistributing,
  distributionResult,
  distributionPhase,
  onCopyMarkdown,
  copiedMarkdown,
}: DistributionCTAProps) {
  const canDistribute = phase === "consolidated" || phase === "distributing" || phase === "distributed" || phase === "error";
  const hasSuccessfulDistribution = Boolean(distributionResult && !distributionResult.error);

  if (!canDistribute) {
    return null;
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader>
        <CardTitle className="text-zinc-100">Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={onDistribute} disabled={isDistributing || phase === "distributing"}>
          {isDistributing ? "Distributing..." : hasSuccessfulDistribution ? "Distributed" : "Distribute to repo"}
        </Button>

        {isDistributing && distributionPhase ? (
          <p className="animate-pulse text-xs text-zinc-400">{distributionPhase}</p>
        ) : null}

        {distributionResult?.error ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
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
              <Button onClick={onCopyMarkdown} variant="secondary" size="sm">
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
  );
}
