"use client";

import { motion } from "motion/react";

import { CodeSnippet } from "@/components/feed/CodeSnippet";
import { ReasoningCard } from "@/components/feed/ReasoningCard";
import { SalienceBadge } from "@/components/feed/SalienceBadge";
import { TriggerPill } from "@/components/feed/TriggerPill";

export interface ActivityEventView {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  salience?: number;
  triggers?: string[];
  snippet?: string;
  variant?: "import" | "reasoning" | "consolidation" | "distribution";
  reasoningText?: string;
  isStreamingReasoning?: boolean;
  raw: Record<string, unknown>;
}

interface ActivityCardProps {
  event: ActivityEventView;
  index: number;
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

  return "border-zinc-800";
}

export function ActivityCard({ event, index }: ActivityCardProps) {
  if (event.variant === "reasoning") {
    return (
      <ReasoningCard
        text={event.reasoningText ?? ""}
        isActive={Boolean(event.isStreamingReasoning)}
        index={index}
      />
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: index * 0.04 }}
      className={`space-y-3 rounded-lg border ${resolveBorderClass(event)} bg-zinc-900/70 p-3 [contain-intrinsic-size:220px] [content-visibility:auto]`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-cyan-300">{event.type}</p>
        {event.salience !== undefined ? <SalienceBadge salience={event.salience} /> : null}
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-100">{event.title}</p>
        {event.subtitle ? <p className="text-xs text-zinc-400">{event.subtitle}</p> : null}
      </div>

      {event.triggers && event.triggers.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {event.triggers.map((trigger) => (
            <TriggerPill key={`${event.id}-${trigger}`} trigger={trigger} />
          ))}
        </div>
      ) : null}

      {event.snippet ? <CodeSnippet snippet={event.snippet} /> : null}
    </motion.article>
  );
}
