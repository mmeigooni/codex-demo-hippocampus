"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Sparkles } from "lucide-react";

import { TriggerPill } from "@/components/feed/TriggerPill";
import { getColorFamilyForPatternKey, getColorFamilyForRule } from "@/lib/color/cluster-palette";
import { entryDelay } from "@/lib/feed/entry-delay";
import { normalizePatternKey } from "@/lib/feed/card-color";

export interface RuleGroupCardProps {
  ruleTitle: string;
  ruleId: string;
  confidence?: number;
  triggers?: string[];
  episodeCount?: number;
  index: number;
  selected?: boolean;
  pinnedFromGraph?: boolean;
  graphNodeId?: string;
  rulePatternKey?: string;
  onSelect?: () => void;
}

function resolveRuleColorKey(ruleId: string, graphNodeId?: string) {
  if (typeof graphNodeId === "string" && graphNodeId.length > 0) {
    return graphNodeId;
  }

  if (ruleId.startsWith("rule-")) {
    return ruleId;
  }

  return `rule-${ruleId}`;
}

function resolveConfidencePercent(confidence?: number) {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    return null;
  }

  const clamped = Math.min(1, Math.max(0, confidence));
  return Math.round(clamped * 100);
}

export function RuleGroupCard({
  ruleTitle,
  ruleId,
  confidence,
  triggers = [],
  episodeCount,
  index,
  selected = false,
  pinnedFromGraph = false,
  graphNodeId,
  rulePatternKey,
  onSelect,
}: RuleGroupCardProps) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (pinnedFromGraph) {
      setExpanded(true);
    }
  }, [pinnedFromGraph]);

  const colorKey = resolveRuleColorKey(ruleId, graphNodeId);
  const patternKey = normalizePatternKey(rulePatternKey);
  const colorFamily = patternKey ? getColorFamilyForPatternKey(patternKey) : getColorFamilyForRule(colorKey);
  const confidencePercent = resolveConfidencePercent(confidence);
  const selectable = Boolean(onSelect && graphNodeId);

  const cardStyle: CSSProperties = {
    borderColor: selected ? colorFamily.accent : colorFamily.borderMuted,
    backgroundColor: `${colorFamily.bgMuted}1a`,
  };

  if (selected) {
    cardStyle.boxShadow = `0 0 0 1px ${colorFamily.accent}`;
  }

  if (pinnedFromGraph) {
    cardStyle.borderLeftColor = colorFamily.accent;
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={
        selectable && !selected
          ? {
              borderColor: colorFamily.border,
              backgroundColor: `${colorFamily.bgMuted}29`,
            }
          : undefined
      }
      transition={{
        type: "spring",
        damping: 24,
        stiffness: 180,
        delay: entryDelay(colorKey, index),
      }}
      className={`space-y-3 rounded-lg border p-3 [contain-intrinsic-size:220px] [content-visibility:auto] ${
        selectable ? "cursor-pointer transition-colors" : ""
      } ${pinnedFromGraph ? "border-l-4" : ""}`}
      style={cardStyle}
      onClick={() => {
        if (!selectable || !onSelect) {
          return;
        }

        onSelect();
      }}
      onKeyDown={(eventKey) => {
        if (!selectable || !onSelect) {
          return;
        }

        if (eventKey.key === "Enter" || eventKey.key === " ") {
          eventKey.preventDefault();
          onSelect();
        }
      }}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-0.5 text-left transition hover:bg-zinc-800/40"
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          setExpanded((current) => !current);
        }}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: colorFamily.accent }} />
          <p className="shrink-0 font-mono text-xs uppercase tracking-wide" style={{ color: colorFamily.accent }}>
            Insight
          </p>
          <p className="truncate text-sm font-medium" style={{ color: colorFamily.text }}>
            {ruleTitle}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFamily.accent }} />
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            style={{ color: colorFamily.textMuted }}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 overflow-hidden"
          >
            {pinnedFromGraph ? (
              <p className="text-[10px] uppercase tracking-wider" style={{ color: colorFamily.textMuted }}>
                Selected from graph
              </p>
            ) : null}

            {typeof episodeCount === "number" && Number.isFinite(episodeCount) ? (
              <span
                className="rounded-full border px-2 py-1 text-xs"
                style={{ borderColor: colorFamily.borderMuted, color: colorFamily.textMuted }}
              >
                Based on {episodeCount} observation{episodeCount === 1 ? "" : "s"}
              </span>
            ) : null}

            {confidencePercent !== null ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span style={{ color: colorFamily.textMuted }}>Pattern strength</span>
                  <span style={{ color: colorFamily.text }}>{confidencePercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800/80">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${confidencePercent}%`, backgroundColor: colorFamily.accent }}
                  />
                </div>
              </div>
            ) : null}

            {triggers.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {triggers.map((trigger) => (
                  <TriggerPill key={`${ruleId}-${trigger}`} trigger={trigger} accentColor={colorFamily.accentMuted} />
                ))}
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
