"use client";

import { motion } from "motion/react";

import type { DreamPhase } from "@/components/sleep-cycle/DreamState";

const PHASE_LABELS: Record<DreamPhase, string> = {
  idle: "Idle",
  dozing: "Dozing",
  reasoning: "Deep Thinking",
  patterning: "Patterning",
  promoting: "Promoting",
  integrating: "Integrating",
  complete: "Complete",
  error: "Error",
};

interface DreamStateMiniProps {
  phase: DreamPhase;
  patterns: number;
  rules: number;
  salienceUpdates: number;
  contradictions: number;
}

export function DreamStateMini({ phase, patterns, rules, salienceUpdates, contradictions }: DreamStateMiniProps) {
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs">
      <motion.span
        key={phase}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 font-medium text-cyan-200"
      >
        {PHASE_LABELS[phase]}
      </motion.span>

      <span className="text-zinc-400">
        <span className="text-zinc-200">{patterns}</span> patterns
      </span>
      <span className="text-zinc-400">
        <span className="text-zinc-200">{rules}</span> rules
      </span>
      <span className="text-zinc-400">
        <span className="text-zinc-200">{salienceUpdates}</span> salience
      </span>
      <span className="text-zinc-400">
        <span className="text-zinc-200">{contradictions}</span> conflicts
      </span>
    </div>
  );
}
