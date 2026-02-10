"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";

import { ReasoningCard } from "@/components/feed/ReasoningCard";
import { SalienceBadge, toneForSalience } from "@/components/feed/SalienceBadge";
import { TriggerPill } from "@/components/feed/TriggerPill";
import { entryDelay } from "@/lib/feed/entry-delay";
import { resolveClusterColor } from "@/lib/feed/card-color";
import { EVENT_TYPE_LABELS } from "@/lib/feed/narrative-partition";

export interface ActivityEventView {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  salience?: number;
  triggers?: string[];
  whyItMatters?: string;
  whatHappened?: string;
  theFix?: string;
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
  tier?: "default" | "milestone";
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

function resolveMilestoneAccentClass(event: ActivityEventView) {
  if (event.type === "pattern_detected") {
    return "border-zinc-700/80 border-l-[3px] border-l-indigo-400/70";
  }

  if (event.type === "contradiction_found") {
    return "border-zinc-700/80 border-l-[3px] border-l-amber-400/70";
  }

  return "border-zinc-700/80 border-l-[3px] border-l-zinc-500/60";
}

export function ActivityCard({
  event,
  index,
  selected = false,
  pinnedFromGraph = false,
  onSelect,
  tier = "default",
}: ActivityCardProps) {
  const [expanded, setExpanded] = useState(
    event.type === "distribution_complete" || event.type === "distribution_error",
  );
  const isMilestone = tier === "milestone";

  useEffect(() => {
    if (pinnedFromGraph) {
      setExpanded(true);
    }
  }, [pinnedFromGraph]);

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
    typeof event.graphNodeId === "string" && event.graphNodeId.length > 0
      ? resolveClusterColor(event.graphNodeId, event.raw)
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
      initial={isMilestone ? { opacity: 0, y: 10, scale: 0.98 } : { opacity: 0, y: 14 }}
      animate={isMilestone ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        damping: 24,
        stiffness: 180,
        delay: entryDelay(event.id, index),
      }}
      className={`space-y-3 rounded-lg border ${isMilestone ? resolveMilestoneAccentClass(event) : resolveBorderClass(event)} ${
        isMilestone ? "bg-zinc-900/80" : "bg-zinc-900/70"
      } p-3 [contain-intrinsic-size:220px] [content-visibility:auto] ${
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
      <div className="flex items-center justify-between gap-3 rounded-md px-1 py-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <p
            className={`shrink-0 font-mono text-xs uppercase tracking-wide ${clusterColor ? "" : "text-cyan-300"}`}
            style={clusterColor ? { color: clusterColor.accent } : undefined}
          >
            {EVENT_TYPE_LABELS[event.type] ?? event.type}
          </p>
          <p className="truncate text-sm font-medium text-zinc-100">{event.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {clusterColor ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: clusterColor.accent }} /> : null}
          {event.salience !== undefined ? (
            <span aria-label={`salience-${event.salience}`} className={`h-2 w-2 rounded-full border ${toneForSalience(event.salience)}`} />
          ) : null}
          <button
            type="button"
            className="rounded p-0.5 transition hover:bg-zinc-800/60"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              setExpanded((current) => !current);
            }}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse details" : "Expand details"}
          >
            <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 overflow-hidden"
          >
            {event.salience !== undefined ? <SalienceBadge salience={event.salience} /> : null}

            {pinnedFromGraph ? (
              <p
                className={`text-[10px] uppercase tracking-wider ${clusterColor ? "" : "text-cyan-200/90"}`}
                style={clusterColor ? { color: clusterColor.textMuted } : undefined}
              >
                Selected from graph
              </p>
            ) : null}

            {event.subtitle ? <p className="text-xs text-zinc-400">{event.subtitle}</p> : null}

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

            {event.type === "distribution_complete" ? (
              <div className="space-y-2">
                {typeof event.raw.prUrl === "string" ? (
                  <p className="text-xs text-emerald-200">
                    PR{" "}
                    <a
                      href={event.raw.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-emerald-300/70 underline-offset-2"
                    >
                      #{String(event.raw.prNumber ?? "?")}
                    </a>
                    {typeof event.raw.branch === "string" ? ` (${event.raw.branch})` : ""}
                  </p>
                ) : null}
                {typeof event.raw.markdown === "string" && event.raw.markdown.length > 0 ? (
                  <details className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
                    <summary className="cursor-pointer text-xs text-zinc-300">team-memory.md</summary>
                    <div className="mt-2 space-y-1">
                      <button
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          void navigator.clipboard.writeText(String(event.raw.markdown));
                        }}
                        className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700/60"
                      >
                        Copy markdown
                      </button>
                      <pre className="max-h-60 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-2 text-[11px] text-zinc-300">
                        {String(event.raw.markdown)}
                      </pre>
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
