"use client";

import type { CSSProperties } from "react";
import { motion } from "motion/react";

import { CodeSnippet } from "@/components/feed/CodeSnippet";
import { ReasoningCard } from "@/components/feed/ReasoningCard";
import { SalienceBadge } from "@/components/feed/SalienceBadge";
import { TriggerPill } from "@/components/feed/TriggerPill";
import {
  getColorFamilyForEpisode,
  getColorFamilyForRule,
  type ColorFamily,
} from "@/lib/color/cluster-palette";
import { entryDelay } from "@/lib/feed/entry-delay";

export interface ActivityEventView {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  salience?: number;
  triggers?: string[];
  whyItMatters?: string;
  snippet?: string;
  groupedEpisodes?: ActivityEventView[];
  variant?: "import" | "reasoning" | "consolidation" | "distribution";
  reasoningText?: string;
  isStreamingReasoning?: boolean;
  graphNodeId?: string;
  graphNodeIds?: string[];
  raw: Record<string, unknown>;
}

interface ActivityCardProps {
  event: ActivityEventView;
  index: number;
  selected?: boolean;
  pinnedFromGraph?: boolean;
  onSelect?: (event: ActivityEventView) => void;
}

function resolveBorderClass(event: ActivityEventView) {
  if (event.variant === "distribution") {
    return "border-purple-500/30";
  }

  if (event.variant === "consolidation" && event.type === "pattern_detected") {
    return "border-indigo-500/30";
  }

  if (event.variant === "consolidation" && event.type === "rule_promoted") {
    return "border-emerald-500/30";
  }

  if (event.variant === "consolidation" && event.type === "contradiction_found") {
    return "border-amber-500/30";
  }

  if (event.variant === "consolidation" && event.type === "salience_updated") {
    return "border-sky-500/30";
  }

  return "border-zinc-700/80";
}

function resolveClusterColor(graphNodeId: string): ColorFamily {
  return graphNodeId.startsWith("rule-")
    ? getColorFamilyForRule(graphNodeId)
    : getColorFamilyForEpisode(graphNodeId);
}

export function ActivityCard({ event, index, selected = false, pinnedFromGraph = false, onSelect }: ActivityCardProps) {
  if (event.variant === "reasoning") {
    return (
      <ReasoningCard
        text={event.reasoningText ?? ""}
        isActive={Boolean(event.isStreamingReasoning)}
        eventId={event.id}
        index={index}
      />
    );
  }

  const selectable = Boolean(onSelect && event.graphNodeId);
  const clusterColor =
    event.variant === "import" && typeof event.graphNodeId === "string" && event.graphNodeId.length > 0
      ? resolveClusterColor(event.graphNodeId)
      : null;

  const handleSelect = () => {
    if (!selectable || !onSelect) {
      return;
    }

    onSelect(event);
  };

  const cardStyle: CSSProperties = {};
  if (clusterColor) {
    cardStyle.borderColor = clusterColor.borderMuted;
  }

  if (selected && clusterColor) {
    cardStyle.borderColor = clusterColor.accent;
    cardStyle.boxShadow = `0 0 0 1px ${clusterColor.accent}`;
  }

  if (pinnedFromGraph && clusterColor) {
    cardStyle.borderLeftColor = clusterColor.accent;
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        damping: 24,
        stiffness: 180,
        delay: entryDelay(event.id, index),
      }}
      className={`space-y-3 rounded-lg border ${resolveBorderClass(event)} bg-zinc-900/70 p-3 [contain-intrinsic-size:220px] [content-visibility:auto] ${
        selectable
          ? `cursor-pointer transition-colors ${clusterColor ? "hover:bg-zinc-900/85" : "hover:border-cyan-300/55 hover:bg-zinc-900/85"}`
          : ""
      } ${selected && !clusterColor ? "border-cyan-300/70 ring-1 ring-cyan-300/60" : ""} ${
        pinnedFromGraph ? `border-l-4 ${clusterColor ? "" : "border-l-cyan-300/90"}` : ""
      }`}
      style={Object.keys(cardStyle).length > 0 ? cardStyle : undefined}
      onClick={handleSelect}
      onKeyDown={(eventKey) => {
        if (!selectable) {
          return;
        }

        if (eventKey.key === "Enter" || eventKey.key === " ") {
          eventKey.preventDefault();
          handleSelect();
        }
      }}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={`font-mono text-xs uppercase tracking-wide ${clusterColor ? "" : "text-cyan-300"}`}
          style={clusterColor ? { color: clusterColor.accent } : undefined}
        >
          {event.type}
        </p>
        {event.salience !== undefined ? <SalienceBadge salience={event.salience} /> : null}
      </div>

      {pinnedFromGraph ? (
        <p
          className={`text-[10px] uppercase tracking-wider ${clusterColor ? "" : "text-cyan-200/90"}`}
          style={clusterColor ? { color: clusterColor.textMuted } : undefined}
        >
          Selected from graph
        </p>
      ) : null}

      <div>
        <p className="text-sm font-medium text-zinc-100">{event.title}</p>
        {event.subtitle ? <p className="text-xs text-zinc-400">{event.subtitle}</p> : null}
      </div>

      {event.triggers && event.triggers.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {event.triggers.map((trigger) => (
            <TriggerPill key={`${event.id}-${trigger}`} trigger={trigger} accentColor={clusterColor?.accentMuted} />
          ))}
        </div>
      ) : null}

      {event.whyItMatters ? (
        <p className="text-xs text-zinc-400 italic">
          <span className="font-medium text-zinc-300 not-italic">Why it matters:</span>{" "}
          {event.whyItMatters}
        </p>
      ) : null}

      {event.snippet ? <CodeSnippet snippet={event.snippet} /> : null}
    </motion.article>
  );
}
