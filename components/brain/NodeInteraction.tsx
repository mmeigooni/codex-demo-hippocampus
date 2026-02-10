"use client";

import { AnimatePresence, motion } from "motion/react";

import type { PositionedBrainNode } from "@/components/brain/types";
import { patternDisplayLabel } from "@/lib/feed/narrative-partition";

interface SelectedNarrative {
  whatHappened?: string;
  thePattern?: string;
  theFix?: string;
  whyItMatters?: string;
  ruleConfidence?: number;
  ruleEpisodeCount?: number;
}

interface NodeInteractionProps {
  node: PositionedBrainNode | null;
  narrative?: SelectedNarrative | null;
}

const NARRATIVE_SECTIONS = [
  { key: "whatHappened", label: "What Happened" },
  { key: "thePattern", label: "The Pattern" },
  { key: "theFix", label: "The Fix" },
  { key: "whyItMatters", label: "Why It Matters" },
] as const;

type NarrativeSection = (typeof NARRATIVE_SECTIONS)[number];

interface SectionColor {
  normal: string;
  bright: string;
}

function normalizeText(value: string | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveObservationCount(count: number | undefined) {
  if (!isFiniteNumber(count)) {
    return null;
  }

  const normalized = Math.round(count);
  return normalized >= 0 ? normalized : null;
}

function sectionColorForIndex(index: number): SectionColor {
  if (index === 2) {
    return {
      normal: "rgba(52, 211, 153, 0.45)",
      bright: "rgba(52, 211, 153, 0.95)",
    };
  }

  if (index >= 3) {
    return {
      normal: "rgba(129, 140, 248, 0.45)",
      bright: "rgba(129, 140, 248, 0.95)",
    };
  }

  return {
    normal: "rgba(34, 211, 238, 0.45)",
    bright: "rgba(34, 211, 238, 0.95)",
  };
}

function resolveNarrativeSections(narrative: SelectedNarrative | null | undefined) {
  return NARRATIVE_SECTIONS.flatMap((section) => {
    const content = normalizeText(narrative?.[section.key]);
    if (!content) {
      return [];
    }

    return [{ ...section, content }];
  });
}

function RuleSummary({
  node,
  narrative,
}: {
  node: PositionedBrainNode;
  narrative: SelectedNarrative | null | undefined;
}) {
  const triggerCount = node.triggers.length;
  const observationCount = resolveObservationCount(narrative?.ruleEpisodeCount);
  const patternLabel = normalizeText(narrative?.thePattern) ?? patternDisplayLabel(node.patternKey);
  const explanation = normalizeText(narrative?.whyItMatters);

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{node.type}</p>
      <p className="text-sm text-zinc-300">Salience: {node.salience}</p>
      <p className="text-xs text-zinc-300">
        <span className="font-semibold text-zinc-200">Pattern:</span> {patternLabel}
      </p>
      {observationCount !== null ? (
        <p className="text-xs text-zinc-400">
          Based on {observationCount} observation{observationCount === 1 ? "" : "s"}
        </p>
      ) : null}
      <div className="space-y-1">
        <p className="text-xs text-zinc-500">Triggers</p>
        {triggerCount > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {node.triggers.map((trigger) => (
              <span
                key={`${node.id}-${trigger}`}
                className="rounded-full border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-300"
              >
                {trigger}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">none</p>
        )}
      </div>
      {explanation ? (
        <p className="text-xs italic text-zinc-400">
          <span className="font-semibold not-italic text-zinc-300">Why it matters:</span> {explanation}
        </p>
      ) : null}
    </div>
  );
}

function EpisodeNarrative({
  node,
  sections,
}: {
  node: PositionedBrainNode;
  sections: Array<NarrativeSection & { content: string }>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-zinc-100">{node.label}</p>
        <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
          {node.type}
        </span>
      </div>
      <div className="space-y-2.5">
        {sections.map((section, index) => {
          const isLast = index === sections.length - 1;
          const colors = sectionColorForIndex(index);
          const delay = index * 0.15;

          return (
            <motion.div
              key={`${node.id}-${section.key}`}
              className="border-l-2 pl-3"
              style={{ borderLeftColor: colors.normal }}
              initial={{ opacity: 0, y: 6 }}
              animate={
                isLast
                  ? {
                      opacity: 1,
                      y: 0,
                      borderLeftColor: [colors.bright, colors.normal],
                    }
                  : { opacity: 1, y: 0 }
              }
              transition={
                isLast
                  ? {
                      type: "spring",
                      damping: 24,
                      stiffness: 180,
                      delay,
                      borderLeftColor: { duration: 0.6, ease: "easeOut", delay: delay + 0.3 },
                    }
                  : { type: "spring", damping: 24, stiffness: 180, delay }
              }
            >
              <p className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">{section.label}</p>
              <p className="text-sm text-zinc-200">{section.content}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function NodeInteraction({ node, narrative = null }: NodeInteractionProps) {
  if (!node) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-300">
        Hover or click a node to inspect episode/rule context.
      </div>
    );
  }

  const narrativeSections = resolveNarrativeSections(narrative);
  const showEpisodeNarrative = node.type === "episode" && narrativeSections.length > 0;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-200">
      <AnimatePresence mode="wait" initial={false}>
        {showEpisodeNarrative ? (
          <motion.div
            key={`${node.id}-narrative`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <EpisodeNarrative node={node} sections={narrativeSections} />
          </motion.div>
        ) : (
          <motion.div
            key={`${node.id}-summary`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="font-semibold text-zinc-100">{node.label}</p>
            <RuleSummary node={node} narrative={narrative} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
