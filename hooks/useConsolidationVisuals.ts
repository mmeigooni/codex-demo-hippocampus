"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ConsolidationVisualCommand,
  ConsolidationVisualState,
} from "@/components/brain/consolidation-visual-types";
import type { ConsolidationEvent } from "@/lib/codex/types";

const INITIAL_VISUAL_STATE: ConsolidationVisualState = {
  isConsolidating: false,
  activeCommand: null,
  commandEpoch: 0,
};

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : 0;
}

export function useConsolidationVisuals() {
  const [visualState, setVisualState] = useState<ConsolidationVisualState>(INITIAL_VISUAL_STATE);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandIdRef = useRef(0);

  const clearScheduledReset = useCallback(() => {
    if (!clearTimeoutRef.current) {
      return;
    }

    clearTimeout(clearTimeoutRef.current);
    clearTimeoutRef.current = null;
  }, []);

  const clearActiveCommand = useCallback(() => {
    setVisualState((current) => {
      if (!current.activeCommand) {
        return current;
      }

      return {
        ...current,
        activeCommand: null,
        commandEpoch: current.commandEpoch + 1,
      };
    });
  }, []);

  const nextCommandId = useCallback(() => {
    commandIdRef.current += 1;
    return `consolidation-command-${commandIdRef.current}`;
  }, []);

  const applyCommand = useCallback(
    (command: ConsolidationVisualCommand, clearAfterMs: number) => {
      clearScheduledReset();

      setVisualState((current) => ({
        ...current,
        activeCommand: command,
        commandEpoch: current.commandEpoch + 1,
      }));

      clearTimeoutRef.current = setTimeout(() => {
        clearTimeoutRef.current = null;
        clearActiveCommand();
      }, clearAfterMs);
    },
    [clearActiveCommand, clearScheduledReset],
  );

  useEffect(() => {
    return () => {
      clearScheduledReset();
    };
  }, [clearScheduledReset]);

  const processConsolidationEvent = useCallback(
    (event: ConsolidationEvent) => {
      const data = toRecord(event.data);

      switch (event.type) {
        case "consolidation_start": {
          setVisualState((current) => ({ ...current, isConsolidating: true }));
          return;
        }
        case "consolidation_complete":
        case "consolidation_error": {
          clearScheduledReset();
          setVisualState(INITIAL_VISUAL_STATE);
          return;
        }
        case "pattern_detected": {
          const episodeNodeIds = toStringArray(data.episode_ids).map((episodeId) => `episode-${episodeId}`);
          const clearAfterMs = 300 * Math.max(episodeNodeIds.length - 1, 0) + 800 + 600;

          applyCommand(
            {
              kind: "replay-chain",
              id: nextCommandId(),
              episodeNodeIds,
              staggerDelayMs: 300,
              holdMs: 800,
            },
            clearAfterMs,
          );
          return;
        }
        case "rule_promoted": {
          const ruleId = typeof data.rule_id === "string" ? data.rule_id : "";
          const rulePatternKey = typeof data.rule_key === "string" ? data.rule_key : "unknown-pattern";

          if (ruleId.length === 0) {
            return;
          }

          applyCommand(
            {
              kind: "rule-promotion",
              id: nextCommandId(),
              sourceEpisodeNodeIds: toStringArray(data.source_episode_ids).map(
                (episodeId) => `episode-${episodeId}`,
              ),
              ruleNodeId: `rule-${ruleId}`,
              rulePatternKey,
            },
            3500,
          );
          return;
        }
        case "salience_updated": {
          const episodeId = typeof data.episode_id === "string" ? data.episode_id : "";
          if (episodeId.length === 0) {
            return;
          }

          applyCommand(
            {
              kind: "salience-shift",
              id: nextCommandId(),
              episodeNodeId: `episode-${episodeId}`,
              newSalience: toNumber(data.salience_score),
            },
            1500,
          );
          return;
        }
        case "contradiction_found": {
          const leftId = typeof data.left_episode_id === "string" ? data.left_episode_id : "";
          const rightId = typeof data.right_episode_id === "string" ? data.right_episode_id : "";

          if (leftId.length === 0 || rightId.length === 0) {
            return;
          }

          applyCommand(
            {
              kind: "contradiction-flash",
              id: nextCommandId(),
              leftNodeId: `episode-${leftId}`,
              rightNodeId: `episode-${rightId}`,
            },
            2000,
          );
          return;
        }
        default:
          return;
      }
    },
    [applyCommand, clearScheduledReset, nextCommandId],
  );

  return {
    visualState,
    processConsolidationEvent,
  };
}
