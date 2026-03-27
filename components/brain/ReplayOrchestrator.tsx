"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SynapticImpulse } from "@/components/brain/SynapticImpulse";
import type { ConsolidationVisualCommand } from "@/components/brain/consolidation-visual-types";

type ActivationMode = "pulse" | "flash-warn" | "salience-shift";

interface ImpulseInstance {
  key: string;
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  durationMs: number;
}

interface ReplayOrchestratorProps {
  command: ConsolidationVisualCommand | null;
  commandEpoch: number;
  positions: Map<string, [number, number, number]>;
  onActivateNode?: (nodeId: string, mode: ActivationMode) => void;
  onHighlightEdge?: (sourceId: string, targetId: string) => void;
  onClearEffects?: () => void;
  getEdgeColor?: (nodeId: string) => string;
}

function defaultEdgeColor() {
  return "#38bdf8";
}

export function ReplayOrchestrator({
  command,
  commandEpoch,
  positions,
  onActivateNode,
  onHighlightEdge,
  onClearEffects,
  getEdgeColor = defaultEdgeColor,
}: ReplayOrchestratorProps) {
  const impulsesRef = useRef<ImpulseInstance[]>([]);
  const [renderImpulses, setRenderImpulses] = useState<ImpulseInstance[]>([]);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const impulseCounterRef = useRef(0);

  const syncImpulsesForRender = useCallback(() => {
    setRenderImpulses(impulsesRef.current.slice());
  }, []);

  const clearImpulses = useCallback(() => {
    if (impulsesRef.current.length === 0) {
      return;
    }

    impulsesRef.current.length = 0;
    syncImpulsesForRender();
  }, [syncImpulsesForRender]);

  const addImpulse = useCallback(
    (impulse: ImpulseInstance) => {
      impulsesRef.current.push(impulse);
      syncImpulsesForRender();
    },
    [syncImpulsesForRender],
  );

  const removeImpulseByKey = useCallback(
    (impulseKey: string) => {
      const index = impulsesRef.current.findIndex((entry) => entry.key === impulseKey);
      if (index < 0) {
        return;
      }

      impulsesRef.current.splice(index, 1);
      syncImpulsesForRender();
    },
    [syncImpulsesForRender],
  );

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) {
        clearTimeout(timer);
      }
      timersRef.current = [];
      clearImpulses();
    };
  }, [clearImpulses]);

  useEffect(() => {
    for (const timer of timersRef.current) {
      clearTimeout(timer);
    }
    timersRef.current = [];
    const clearImpulsesTimer = setTimeout(() => {
      clearImpulses();
    }, 0);
    onClearEffects?.();

    if (!command) {
      return () => {
        clearTimeout(clearImpulsesTimer);
      };
    }

    const nextImpulseKey = () => {
      impulseCounterRef.current += 1;
      return `${command.id}-impulse-${impulseCounterRef.current}`;
    };

    const spawnImpulse = (
      sourceId: string,
      targetId: string,
      options?: {
        durationMs?: number;
        colorFromNodeId?: string;
      },
    ) => {
      const from = positions.get(sourceId);
      const to = positions.get(targetId);
      if (!from || !to) {
        return;
      }

      const durationMs = options?.durationMs ?? 800;
      const colorNodeId = options?.colorFromNodeId ?? sourceId;

      addImpulse({
        key: nextImpulseKey(),
        from,
        to,
        color: getEdgeColor(colorNodeId),
        durationMs,
      });
    };

    const schedule = (delayMs: number, callback: () => void) => {
      const timer = setTimeout(callback, delayMs);
      timersRef.current.push(timer);
    };

    switch (command.kind) {
      case "replay-chain": {
        const nodeIds = command.episodeNodeIds;
        for (const [index, nodeId] of nodeIds.entries()) {
          schedule(index * command.staggerDelayMs, () => {
            onActivateNode?.(nodeId, "pulse");
            const nextId = nodeIds[index + 1];
            if (!nextId) {
              return;
            }

            onHighlightEdge?.(nodeId, nextId);
            spawnImpulse(nodeId, nextId, {
              durationMs: Math.max(600, command.holdMs),
            });
          });
        }
        break;
      }
      case "rule-promotion": {
        const sourceIds = command.sourceEpisodeNodeIds;
        const sourceStaggerMs = 200;
        const convergenceDelayMs = sourceIds.length * sourceStaggerMs + 200;

        for (const [index, sourceId] of sourceIds.entries()) {
          schedule(index * sourceStaggerMs, () => {
            onActivateNode?.(sourceId, "pulse");
          });
        }

        schedule(convergenceDelayMs, () => {
          for (const sourceId of sourceIds) {
            onHighlightEdge?.(sourceId, command.ruleNodeId);
            spawnImpulse(sourceId, command.ruleNodeId, {
              durationMs: 900,
              colorFromNodeId: command.ruleNodeId,
            });
          }
        });

        schedule(convergenceDelayMs + 500, () => {
          onActivateNode?.(command.ruleNodeId, "pulse");
        });
        break;
      }
      case "salience-shift": {
        onActivateNode?.(command.episodeNodeId, "salience-shift");
        break;
      }
      case "contradiction-flash": {
        onActivateNode?.(command.leftNodeId, "flash-warn");
        onActivateNode?.(command.rightNodeId, "flash-warn");
        break;
      }
      default:
        break;
    }
    return () => {
      clearTimeout(clearImpulsesTimer);
    };
  }, [
    addImpulse,
    clearImpulses,
    command,
    commandEpoch,
    getEdgeColor,
    onActivateNode,
    onClearEffects,
    onHighlightEdge,
    positions,
  ]);

  return (
    <group>
      {renderImpulses.map((impulse) => (
        <SynapticImpulse
          key={impulse.key}
          from={impulse.from}
          to={impulse.to}
          color={impulse.color}
          durationMs={impulse.durationMs}
          onComplete={() => {
            removeImpulseByKey(impulse.key);
          }}
        />
      ))}
    </group>
  );
}
