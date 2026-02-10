"use client";

import { useCallback, useState } from "react";

import type { DistributionEvent, DistributionEventType } from "@/lib/codex/types";
import { parseJsonSseBuffer } from "@/lib/sse/parse";

export interface DistributionResult {
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

const DISTRIBUTION_EVENT_TYPES: DistributionEventType[] = [
  "distribution_start",
  "pack_rendered",
  "branch_created",
  "file_committed",
  "pr_creating",
  "pr_created",
  "distribution_complete",
  "distribution_error",
];

function toObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isDistributionEventType(value: string): value is DistributionEventType {
  return DISTRIBUTION_EVENT_TYPES.includes(value as DistributionEventType);
}

function toDistributionEvent(event: { type: string; data: unknown }): DistributionEvent | null {
  if (!isDistributionEventType(event.type)) {
    return null;
  }

  return {
    type: event.type,
    data: event.data,
  };
}

function parseDistributionCompleteData(value: unknown): DistributionCompleteEventData {
  const data = toObject(value);

  return {
    skipped_pr: Boolean(data.skipped_pr),
    reason: asString(data.reason),
    markdown: asString(data.markdown) ?? "",
    pr_url: asString(data.pr_url),
    pr_number: asNumber(data.pr_number),
    branch: asString(data.branch),
  };
}

function mapDistributionPhase(eventType: DistributionEvent["type"]): string | null {
  if (eventType === "distribution_start") {
    return "Preparing distribution...";
  }

  if (eventType === "pack_rendered") {
    return "Pack rendered. Creating branch...";
  }

  if (eventType === "branch_created") {
    return "Branch created. Committing file...";
  }

  if (eventType === "file_committed") {
    return "File committed. Opening PR...";
  }

  if (eventType === "pr_creating") {
    return "Creating pull request...";
  }

  if (eventType === "distribution_complete" || eventType === "distribution_error") {
    return null;
  }

  return null;
}

export function useDistributionStream() {
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionResult, setDistributionResult] = useState<DistributionResult | null>(null);
  const [distributionPhase, setDistributionPhase] = useState<string | null>(null);

  const runDistribution = useCallback(async (repoId: string) => {
    if (!repoId) {
      return;
    }

    setIsDistributing(true);
    setDistributionResult(null);
    setDistributionPhase("Preparing distribution...");

    try {
      const response = await fetch("/api/distribute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_id: repoId }),
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

        const chunkEvents = parsed.events
          .map(toDistributionEvent)
          .filter((event): event is DistributionEvent => event !== null);

        for (const event of chunkEvents) {
          const phase = mapDistributionPhase(event.type);
          if (phase !== null || event.type === "distribution_complete" || event.type === "distribution_error") {
            setDistributionPhase(phase);
          }

          if (event.type === "distribution_complete") {
            const data = parseDistributionCompleteData(event.data);
            setDistributionResult({
              prUrl: data.pr_url,
              prNumber: data.pr_number,
              branch: data.branch,
              skippedPr: Boolean(data.skipped_pr),
              reason: data.reason,
              markdown: data.markdown,
            });
            continue;
          }

          if (event.type === "distribution_error") {
            const data = toObject(event.data);
            setDistributionResult({
              skippedPr: true,
              error: String(data.message ?? "Distribution failed"),
            });
          }
        }
      }
    } catch (distributionError) {
      const message = distributionError instanceof Error ? distributionError.message : "Failed to distribute pack";
      setDistributionResult({
        skippedPr: true,
        error: message,
      });
      setDistributionPhase(null);
    } finally {
      setIsDistributing(false);
    }
  }, []);

  return {
    runDistribution,
    isDistributing,
    distributionResult,
    distributionPhase,
  };
}
