"use client";

import { Fragment, type CSSProperties } from "react";
import { motion } from "motion/react";

import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { resolveClusterColor } from "@/lib/feed/card-color";
import { entryDelay } from "@/lib/feed/entry-delay";

interface PatternRowProps {
  event: ActivityEventView;
  observationIndexMap: Map<string, number>;
  index: number;
  selected?: boolean;
  onSelect?: (event: ActivityEventView) => void;
}

interface DotEntry {
  graphNodeId: string;
  observationIndex: number;
  color: ReturnType<typeof resolveClusterColor>;
}

function toPatternDescription(event: ActivityEventView): string {
  const summary = typeof event.raw.summary === "string" ? event.raw.summary.trim() : "";
  if (summary.length > 0) {
    return summary;
  }

  const subtitle = typeof event.subtitle === "string" ? event.subtitle.trim() : "";
  if (subtitle.length > 0) {
    return subtitle;
  }

  return event.title;
}

function toDotEntries(event: ActivityEventView, observationIndexMap: Map<string, number>): DotEntry[] {
  const episodeIds = Array.isArray(event.raw.episode_ids)
    ? event.raw.episode_ids.filter((episodeId): episodeId is string => typeof episodeId === "string" && episodeId.length > 0)
    : [];

  return episodeIds
    .map((episodeId) => {
      const graphNodeId = `episode-${episodeId}`;
      const observationIndex = observationIndexMap.get(graphNodeId);
      if (observationIndex === undefined) {
        return null;
      }

      return {
        graphNodeId,
        observationIndex,
        color: resolveClusterColor(graphNodeId, {}),
      } satisfies DotEntry;
    })
    .filter((entry): entry is DotEntry => entry !== null);
}

export function PatternRow({ event, observationIndexMap, index, selected = false, onSelect }: PatternRowProps) {
  const selectable = Boolean(onSelect && event.graphNodeId);
  const clusterColor =
    typeof event.graphNodeId === "string" && event.graphNodeId.length > 0
      ? resolveClusterColor(event.graphNodeId, event.raw)
      : null;
  const dotEntries = toDotEntries(event, observationIndexMap);
  const description = toPatternDescription(event);

  const rowStyle: CSSProperties = {};
  if (selected && clusterColor) {
    rowStyle.boxShadow = `inset 0 0 0 1px ${clusterColor.accent}`;
  }

  const handleSelect = () => {
    if (!selectable || !onSelect) {
      return;
    }

    onSelect(event);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: "spring",
        damping: 28,
        stiffness: 200,
        delay: entryDelay(event.id, index),
      }}
      className={`flex flex-col gap-1.5 rounded px-2 py-1.5 text-xs ${
        selectable ? "cursor-pointer transition hover:bg-zinc-800/50" : ""
      } ${selected && clusterColor ? "bg-zinc-800/60" : ""} ${
        selected && !clusterColor ? "bg-zinc-800/60 ring-1 ring-inset ring-cyan-300/60" : ""
      }`}
      style={Object.keys(rowStyle).length > 0 ? rowStyle : undefined}
      onClick={handleSelect}
      onKeyDown={(keyEvent) => {
        if (!selectable) {
          return;
        }

        if (keyEvent.key === "Enter" || keyEvent.key === " ") {
          keyEvent.preventDefault();
          handleSelect();
        }
      }}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
    >
      <div className="flex min-w-0 items-center gap-2">
        {clusterColor ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: clusterColor.accent }} /> : null}
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-zinc-500">Pattern</span>
        <span className="min-w-0 truncate text-zinc-300">{description}</span>
      </div>

      {dotEntries.length > 0 ? (
        <div className="flex items-center gap-0">
          {dotEntries.map((dot, dotIndex) => (
            <Fragment key={`${dot.graphNodeId}-${dotIndex}`}>
              {dotIndex > 0 ? (
                <span className="h-px w-3" style={{ backgroundColor: dot.color.accentMuted }} />
              ) : null}
              <span className="flex items-center gap-0.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot.color.accent }} />
                <span className="font-mono text-[9px] text-zinc-500">#{dot.observationIndex}</span>
              </span>
            </Fragment>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}
