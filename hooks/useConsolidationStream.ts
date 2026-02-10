"use client";

import { useCallback, useEffect, useState } from "react";

import { useTheatricalScheduler } from "@/hooks/useTheatricalScheduler";
import type { ConsolidationEvent, ConsolidationEventType } from "@/lib/codex/types";
import type { ConsolidationModelOutput } from "@/lib/codex/types";
import { parseJsonSseBuffer } from "@/lib/sse/parse";

export type DreamPhase =
  | "idle"
  | "dozing"
  | "reasoning"
  | "patterning"
  | "promoting"
  | "integrating"
  | "complete"
  | "error";

export interface ConsolidationSummary {
  counts?: {
    patterns?: number;
    rules_promoted?: number;
    salience_updates?: number;
    contradictions?: number;
  };
  pack?: ConsolidationModelOutput;
}

export interface ConsolidationProgress {
  patterns: number;
  rules: number;
  salienceUpdates: number;
  contradictions: number;
}

type StorageMode = "supabase" | "memory-fallback";

interface UseConsolidationStreamOptions {
  initialPack?: ConsolidationModelOutput | null;
}

const CONSOLIDATION_EVENT_TYPES: ConsolidationEventType[] = [
  "replay_manifest",
  "consolidation_start",
  "reasoning_start",
  "reasoning_delta",
  "reasoning_complete",
  "response_start",
  "response_delta",
  "pattern_detected",
  "rule_promoted",
  "contradiction_found",
  "salience_updated",
  "consolidation_complete",
  "consolidation_error",
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

function isConsolidationEventType(value: string): value is ConsolidationEventType {
  return CONSOLIDATION_EVENT_TYPES.includes(value as ConsolidationEventType);
}

function toConsolidationEvent(event: { type: string; data: unknown }): ConsolidationEvent | null {
  if (!isConsolidationEventType(event.type)) {
    return null;
  }

  return {
    type: event.type,
    data: event.data,
  };
}

function parseConsolidationSummary(value: unknown): ConsolidationSummary | null {
  const summaryRecord = toObject(value);
  if (Object.keys(summaryRecord).length === 0) {
    return null;
  }

  const countsRecord = toObject(summaryRecord.counts);
  const counts: ConsolidationSummary["counts"] = {
    patterns: asNumber(countsRecord.patterns),
    rules_promoted: asNumber(countsRecord.rules_promoted),
    salience_updates: asNumber(countsRecord.salience_updates),
    contradictions: asNumber(countsRecord.contradictions),
  };

  return { counts };
}

function nextDreamPhase(current: DreamPhase, eventType: ConsolidationEventType): DreamPhase {
  if (eventType === "consolidation_error") {
    return "error";
  }

  if (eventType === "consolidation_complete") {
    return "complete";
  }

  if (
    eventType === "reasoning_start" ||
    eventType === "reasoning_delta" ||
    eventType === "reasoning_complete" ||
    eventType === "response_start" ||
    eventType === "response_delta"
  ) {
    return "reasoning";
  }

  if (eventType === "salience_updated" || eventType === "contradiction_found") {
    return "integrating";
  }

  if (eventType === "rule_promoted") {
    return "promoting";
  }

  if (eventType === "pattern_detected") {
    return "patterning";
  }

  if (eventType === "consolidation_start") {
    return "dozing";
  }

  return current;
}

function updateProgress(current: ConsolidationProgress, event: ConsolidationEvent): ConsolidationProgress {
  const data = toObject(event.data);

  if (event.type === "pattern_detected") {
    return { ...current, patterns: current.patterns + 1 };
  }

  if (event.type === "rule_promoted") {
    return { ...current, rules: current.rules + 1 };
  }

  if (event.type === "salience_updated") {
    return { ...current, salienceUpdates: current.salienceUpdates + 1 };
  }

  if (event.type === "contradiction_found") {
    return { ...current, contradictions: current.contradictions + 1 };
  }

  if (event.type === "consolidation_complete") {
    const summary = parseConsolidationSummary(data.summary);
    return {
      patterns: Number(summary?.counts?.patterns ?? current.patterns),
      rules: Number(summary?.counts?.rules_promoted ?? current.rules),
      salienceUpdates: Number(summary?.counts?.salience_updates ?? current.salienceUpdates),
      contradictions: Number(summary?.counts?.contradictions ?? current.contradictions),
    };
  }

  return current;
}

function initialSummaryFromPack(initialPack: ConsolidationModelOutput | null) {
  if (!initialPack) {
    return null;
  }

  return {
    counts: {
      patterns: initialPack.patterns.length,
      rules_promoted: initialPack.rules_to_promote.length,
      salience_updates: initialPack.salience_updates.length,
      contradictions: initialPack.contradictions.length,
    },
    pack: initialPack,
  } satisfies ConsolidationSummary;
}

type ConsolidationScheduledEvent = ConsolidationEvent & { streamText?: string };

export function useConsolidationStream({ initialPack = null }: UseConsolidationStreamOptions = {}) {
  const [phase, setPhase] = useState<DreamPhase>("idle");
  const [events, setEvents] = useState<ConsolidationEvent[]>([]);
  const [progress, setProgress] = useState<ConsolidationProgress>({
    patterns: 0,
    rules: 0,
    salienceUpdates: 0,
    contradictions: 0,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);
  const [summary, setSummary] = useState<ConsolidationSummary | null>(initialSummaryFromPack(initialPack));
  const [reasoningText, setReasoningText] = useState("");
  const [isReasoningActive, setIsReasoningActive] = useState(false);

  const applyConsolidationEvents = useCallback((chunkEvents: ConsolidationEvent[]) => {
    const visibleEvents = chunkEvents.filter((event) => event.type !== "replay_manifest");

    if (visibleEvents.length === 0) {
      return;
    }

    setEvents((current) => [...current, ...visibleEvents]);
    setProgress((current) => visibleEvents.reduce((next, event) => updateProgress(next, event), current));
    setPhase((current) => visibleEvents.reduce((next, event) => nextDreamPhase(next, event.type), current));

    for (const event of visibleEvents) {
      if (event.type === "reasoning_start") {
        setIsReasoningActive(true);
        setReasoningText("");
        continue;
      }

      if (event.type === "reasoning_delta") {
        const data = toObject(event.data);
        setIsReasoningActive(true);
        setReasoningText(asString(data.text) ?? "");
        continue;
      }

      if (event.type === "reasoning_complete") {
        const data = toObject(event.data);
        setIsReasoningActive(false);
        const text = asString(data.text);
        if (text) {
          setReasoningText(text);
        }
        continue;
      }

      if (event.type === "consolidation_complete") {
        const data = toObject(event.data);
        const completeSummary = parseConsolidationSummary(data.summary);
        setSummary(completeSummary);
        continue;
      }

      if (event.type === "consolidation_error") {
        const data = toObject(event.data);
        setError(String(asString(data.message) ?? "Consolidation failed"));
      }
    }
  }, []);

  const { enqueue: enqueueReplayEvents, cancel: cancelReplayEvents } = useTheatricalScheduler<ConsolidationScheduledEvent>({
    onEventRelease: (event) => {
      applyConsolidationEvents([{ type: event.type, data: event.data }]);
    },
    onTextStreamChunk: (_event, text) => {
      setIsReasoningActive(true);
      setReasoningText(text);
    },
    onTextStreamComplete: (_event, text) => {
      setIsReasoningActive(false);
      setReasoningText(text);
    },
    onComplete: () => {
      setIsRunning(false);
      setIsReasoningActive(false);
    },
  });

  useEffect(() => {
    return () => {
      cancelReplayEvents();
    };
  }, [cancelReplayEvents]);

  const runConsolidation = useCallback(
    async (repoId: string) => {
      if (!repoId) {
        return;
      }

      cancelReplayEvents();
      setIsRunning(true);
      setError(null);
      setSummary(null);
      setStorageMode(null);
      setEvents([]);
      setReasoningText("");
      setIsReasoningActive(false);
      setProgress({
        patterns: 0,
        rules: 0,
        salienceUpdates: 0,
        contradictions: 0,
      });
      setPhase("dozing");

      let replayScheduled = false;

      try {
        const response = await fetch("/api/consolidate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ repo_id: repoId }),
        });

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to start consolidation stream");
        }

        const modeHeader = response.headers.get("x-hippocampus-storage-mode");
        if (modeHeader === "supabase" || modeHeader === "memory-fallback") {
          setStorageMode(modeHeader);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamMode: "unknown" | "live" | "replay" = "unknown";
        const replayEvents: ConsolidationEvent[] = [];

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
            .map(toConsolidationEvent)
            .filter((event): event is ConsolidationEvent => event !== null);
          if (chunkEvents.length === 0) {
            continue;
          }

          const replayDetected = chunkEvents.some((event) => {
            if (event.type !== "replay_manifest") {
              return false;
            }

            const data = toObject(event.data);
            return data.mode === "consolidation_replay";
          });

          if (streamMode === "unknown" && replayDetected) {
            streamMode = "replay";
          }

          if (streamMode === "replay") {
            replayEvents.push(...chunkEvents.filter((event) => event.type !== "replay_manifest"));
            continue;
          }

          if (streamMode === "unknown") {
            streamMode = "live";
          }

          applyConsolidationEvents(chunkEvents);
        }

        if (streamMode === "replay") {
          const scheduledEvents: ConsolidationScheduledEvent[] = replayEvents.map((event) => {
            if (event.type !== "reasoning_complete") {
              return event;
            }

            const data = toObject(event.data);
            const text = asString(data.text) ?? "";
            if (text.length === 0) {
              return event;
            }

            return {
              ...event,
              data: {
                ...data,
                text: "",
              },
              streamText: text,
            };
          });

          if (scheduledEvents.length > 0) {
            replayScheduled = true;
            enqueueReplayEvents(scheduledEvents);
          }
        }
      } catch (runError) {
        const message = runError instanceof Error ? runError.message : "Failed to run consolidation";
        setError(message);
        setPhase("error");
      } finally {
        if (!replayScheduled) {
          setIsRunning(false);
          setIsReasoningActive(false);
        }
      }
    },
    [applyConsolidationEvents, cancelReplayEvents, enqueueReplayEvents],
  );

  return {
    runConsolidation,
    phase,
    events,
    progress,
    isRunning,
    error,
    storageMode,
    summary,
    reasoningText,
    isReasoningActive,
  };
}
