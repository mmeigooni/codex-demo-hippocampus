"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";

import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { SalienceBadge } from "@/components/feed/SalienceBadge";
import { TriggerPill } from "@/components/feed/TriggerPill";

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

  const meanSalience = useMemo(() => averageSalience(episodes), [episodes]);
  const hasSelectedEpisode = useMemo(
    () => Boolean(selectedEpisodeId && episodes.some((episode) => episode.id === selectedEpisodeId)),
    [episodes, selectedEpisodeId],
  );

  useEffect(() => {
    if (hasSelectedEpisode) {
      setExpanded(true);
    }
  }, [hasSelectedEpisode]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: index * 0.04 }}
      className={`space-y-3 rounded-lg border border-cyan-700/30 bg-zinc-900/70 p-3 [contain-intrinsic-size:220px] [content-visibility:auto] ${
        selected ? "border-cyan-300/70 ring-1 ring-cyan-300/60" : ""
      } ${pinnedFromGraph ? "border-l-4 border-l-cyan-300/90" : ""}`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-0.5 text-left transition hover:bg-zinc-800/40"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-wide text-cyan-300">PR #{prNumber}</p>
          <p className="text-sm font-medium text-zinc-100">{prTitle}</p>
          <p className="text-xs text-zinc-400">{episodes.length} episode{episodes.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2">
          {meanSalience !== undefined ? <SalienceBadge salience={meanSalience} /> : null}
          <ChevronDown className={`h-4 w-4 text-zinc-300 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {pinnedFromGraph ? (
        <p className="text-[10px] uppercase tracking-wider text-cyan-200/90">Selected from graph</p>
      ) : null}

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 overflow-hidden"
          >
            {episodes.map((episode) => {
              const selectable = Boolean(onSelectEpisode && episode.graphNodeId);
              const episodeSelected = selectedEpisodeId === episode.id;

              return (
                <button
                  key={episode.id}
                  type="button"
                  className={`w-full rounded-md border border-zinc-800 bg-zinc-950/50 p-2 text-left ${
                    selectable ? "transition hover:border-cyan-300/40" : "cursor-default"
                  } ${episodeSelected ? "border-cyan-300/70 ring-1 ring-cyan-300/60" : ""}`}
                  onClick={() => {
                    if (!selectable || !onSelectEpisode) {
                      return;
                    }

                    onSelectEpisode(episode);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-wide text-cyan-300">{episode.type}</p>
                    {episode.salience !== undefined ? <SalienceBadge salience={episode.salience} /> : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-zinc-100">{episode.title}</p>
                  {episode.subtitle ? <p className="text-xs text-zinc-400">{episode.subtitle}</p> : null}
                  {episode.triggers && episode.triggers.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {episode.triggers.map((trigger) => (
                        <TriggerPill key={`${episode.id}-${trigger}`} trigger={trigger} />
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
