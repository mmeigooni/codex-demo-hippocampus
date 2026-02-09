"use client";

import type { CSSProperties } from "react";
import { motion } from "motion/react";

import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { toneForSalience } from "@/components/feed/SalienceBadge";
import { resolveClusterColor } from "@/lib/feed/card-color";
import { entryDelay } from "@/lib/feed/entry-delay";
import { EVENT_TYPE_LABELS } from "@/lib/feed/narrative-partition";

interface ObservationRowProps {
  event: ActivityEventView;
  index: number;
  selected?: boolean;
  pinnedFromGraph?: boolean;
  onSelect?: (event: ActivityEventView) => void;
}

export function ObservationRow({
  event,
  index,
  selected = false,
  pinnedFromGraph = false,
  onSelect,
}: ObservationRowProps) {
  const selectable = Boolean(onSelect && event.graphNodeId);
  const clusterColor =
    typeof event.graphNodeId === "string" && event.graphNodeId.length > 0
      ? resolveClusterColor(event.graphNodeId, event.raw)
      : null;

  const rowStyle: CSSProperties = {};
  if (selected && clusterColor) {
    rowStyle.boxShadow = `inset 0 0 0 1px ${clusterColor.accent}`;
  }

  if (pinnedFromGraph && clusterColor) {
    rowStyle.borderLeftColor = clusterColor.accent;
  }

  const title =
    event.type === "pr_group" && Array.isArray(event.groupedEpisodes) && event.groupedEpisodes.length > 0
      ? `${event.title} (${event.groupedEpisodes.length})`
      : event.title;

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
      className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${
        selectable ? "cursor-pointer transition hover:bg-zinc-800/50" : ""
      } ${selected && clusterColor ? "bg-zinc-800/60" : ""} ${
        selected && !clusterColor ? "bg-zinc-800/60 ring-1 ring-inset ring-cyan-300/60" : ""
      } ${pinnedFromGraph ? `border-l-2 ${clusterColor ? "" : "border-l-cyan-300/90"}` : ""}`}
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
      {clusterColor ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: clusterColor.accent }} /> : null}
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        {EVENT_TYPE_LABELS[event.type] ?? event.type}
      </span>
      <span className="min-w-0 flex-1 truncate text-zinc-300">{title}</span>
      {typeof event.salience === "number" && event.salience >= 5 ? (
        <span aria-label={`salience-${event.salience}`} className={`h-2 w-2 shrink-0 rounded-full border ${toneForSalience(event.salience)}`} />
      ) : null}
    </motion.div>
  );
}
