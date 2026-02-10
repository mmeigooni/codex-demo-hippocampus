"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";

import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { SalienceBadge } from "@/components/feed/SalienceBadge";
import { TriggerPill } from "@/components/feed/TriggerPill";
import { resolveClusterColor } from "@/lib/feed/card-color";
import { entryDelay } from "@/lib/feed/entry-delay";
import { EVENT_TYPE_LABELS } from "@/lib/feed/narrative-partition";

interface PRGroupCardProps {
  prNumber: number;
  prTitle: string;
  episodes: ActivityEventView[];
  index: number;
  selected?: boolean;
  pinnedFromGraph?: boolean;
  selectedEpisodeId?: string | null;
  onSelectEpisode?: (event: ActivityEventView) => void;
}

function averageSalience(episodes: ActivityEventView[]) {
  const values = episodes
    .map((episode) => episode.salience)
    .filter((salience): salience is number => typeof salience === "number");

  if (values.length === 0) {
    return undefined;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

export function PRGroupCard({
  prNumber,
  prTitle,
  episodes,
  index,
  selected = false,
  pinnedFromGraph = false,
  selectedEpisodeId = null,
  onSelectEpisode,
}: PRGroupCardProps) {
  const [expanded, setExpanded] = useState(false);
  const delayKey = `pr-${prNumber}-${prTitle}`;

  const meanSalience = useMemo(() => averageSalience(episodes), [episodes]);
  const hasSelectedEpisode = useMemo(
    () => Boolean(selectedEpisodeId && episodes.some((episode) => episode.id === selectedEpisodeId)),
    [episodes, selectedEpisodeId],
  );
  const clusterColor = useMemo(() => {
    const firstLinkedEpisode = episodes.find(
      (episode) => typeof episode.graphNodeId === "string" && episode.graphNodeId.length > 0,
    );

    return firstLinkedEpisode?.graphNodeId
      ? resolveClusterColor(firstLinkedEpisode.graphNodeId, firstLinkedEpisode.raw)
      : null;
  }, [episodes]);

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

  useEffect(() => {
    if (hasSelectedEpisode) {
      const expandTimer = setTimeout(() => {
        setExpanded(true);
      }, 0);

      return () => {
        clearTimeout(expandTimer);
      };
    }
  }, [hasSelectedEpisode]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={
        selected
          ? undefined
          : {
              borderColor: clusterColor ? clusterColor.border : "rgba(103, 232, 249, 0.45)",
              backgroundColor: "rgba(24, 24, 27, 0.82)",
            }
      }
      transition={{
        type: "spring",
        damping: 24,
        stiffness: 180,
        delay: entryDelay(delayKey, index),
      }}
      className={`space-y-3 rounded-lg border border-zinc-700/80 bg-zinc-900/70 p-3 transition-colors [contain-intrinsic-size:220px] [content-visibility:auto] ${
        selected && !clusterColor ? "border-cyan-300/70 ring-1 ring-cyan-300/60" : ""
      } ${pinnedFromGraph ? `border-l-4 ${clusterColor ? "" : "border-l-cyan-300/90"}` : ""}`}
      style={Object.keys(cardStyle).length > 0 ? cardStyle : undefined}
    >
      <div className="flex items-center justify-between gap-3 rounded-md px-1 py-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <p
            className={`shrink-0 font-mono text-xs uppercase tracking-wide ${clusterColor ? "" : "text-cyan-300"}`}
            style={clusterColor ? { color: clusterColor.accent } : undefined}
          >
            Code Review #{prNumber}
          </p>
          <p className="truncate text-sm font-medium text-zinc-100">{prTitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {clusterColor ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: clusterColor.accent }} /> : null}
          {meanSalience !== undefined ? <span className="text-xs text-zinc-500">{meanSalience}</span> : null}
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
            <ChevronDown className={`h-4 w-4 text-zinc-300 transition-transform ${expanded ? "rotate-180" : ""}`} />
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
            <p className="text-xs text-zinc-400">
              {episodes.length} observation{episodes.length === 1 ? "" : "s"}
            </p>
            {meanSalience !== undefined ? <SalienceBadge salience={meanSalience} /> : null}
            {pinnedFromGraph ? (
              <p
                className={`text-[10px] uppercase tracking-wider ${clusterColor ? "" : "text-cyan-200/90"}`}
                style={clusterColor ? { color: clusterColor.textMuted } : undefined}
              >
                Selected from graph
              </p>
            ) : null}
            {episodes.map((episode) => {
              const selectable = Boolean(onSelectEpisode && episode.graphNodeId);
              const episodeSelected = selectedEpisodeId === episode.id;

              return (
                <button
                  key={episode.id}
                  type="button"
                  className={`w-full rounded-md border border-zinc-700/80 bg-zinc-950/50 p-2 text-left ${
                    selectable
                      ? `transition-colors ${clusterColor ? "hover:bg-zinc-950/70" : "hover:border-cyan-300/55 hover:bg-zinc-950/70"}`
                      : "cursor-default"
                  } ${episodeSelected && !clusterColor ? "border-cyan-300/70 ring-1 ring-cyan-300/60" : ""}`}
                  style={
                    clusterColor && episodeSelected
                      ? {
                          borderColor: clusterColor.accent,
                          boxShadow: `0 0 0 1px ${clusterColor.accent}`,
                        }
                      : undefined
                  }
                  onClick={() => {
                    if (!selectable || !onSelectEpisode) {
                      return;
                    }

                    onSelectEpisode(episode);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-xs uppercase tracking-wide ${clusterColor ? "" : "text-cyan-300"}`}
                      style={clusterColor ? { color: clusterColor.accent } : undefined}
                    >
                      {EVENT_TYPE_LABELS[episode.type] ?? episode.type}
                    </p>
                    {episode.salience !== undefined ? <SalienceBadge salience={episode.salience} /> : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-zinc-100">{episode.title}</p>
                  {episode.subtitle ? <p className="text-xs text-zinc-400">{episode.subtitle}</p> : null}
                  {episode.triggers && episode.triggers.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {episode.triggers.map((trigger) => (
                        <TriggerPill
                          key={`${episode.id}-${trigger}`}
                          trigger={trigger}
                          accentColor={clusterColor?.accentMuted}
                        />
                      ))}
                    </div>
                  ) : null}
                  {episode.whyItMatters ? (
                    <p className="mt-2 text-xs text-zinc-400 italic">
                      <span className="font-medium text-zinc-300 not-italic">Why it matters:</span>{" "}
                      {episode.whyItMatters}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
