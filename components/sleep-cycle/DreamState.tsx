"use client";

import { motion } from "motion/react";

export type DreamPhase =
  | "idle"
  | "dozing"
  | "reasoning"
  | "patterning"
  | "promoting"
  | "integrating"
  | "complete"
  | "error";

interface DreamStateProps {
  phase: DreamPhase;
  patterns: number;
  rules: number;
  salienceUpdates: number;
  contradictions: number;
}

const PHASE_LABELS: Record<DreamPhase, string> = {
  idle: "Idle",
  dozing: "Dozing",
  reasoning: "Reasoning",
  patterning: "Detecting Patterns",
  promoting: "Promoting Rules",
  integrating: "Integrating Memory",
  complete: "Complete",
  error: "Error",
};

const PHASE_ORDER: DreamPhase[] = [
  "idle",
  "dozing",
  "reasoning",
  "patterning",
  "promoting",
  "integrating",
  "complete",
  "error",
];

function phaseColor(phase: DreamPhase, current: DreamPhase) {
  const currentIndex = PHASE_ORDER.indexOf(current);
  const phaseIndex = PHASE_ORDER.indexOf(phase);

  if (current === "error") {
    return phase === "error" ? "border-rose-500 bg-rose-500/20 text-rose-200" : "border-zinc-800 text-zinc-500";
  }

  if (phaseIndex <= currentIndex && phase !== "error") {
    return "border-cyan-400/60 bg-cyan-400/10 text-cyan-200";
  }

  return "border-zinc-800 text-zinc-500";
}

export function DreamState({ phase, patterns, rules, salienceUpdates, contradictions }: DreamStateProps) {
  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">Dream state</h3>
        <motion.span
          key={phase}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs text-cyan-200"
        >
          {PHASE_LABELS[phase]}
        </motion.span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {PHASE_ORDER.filter((item) => item !== "error").map((item) => (
          <div
            key={item}
            className={`rounded-md border px-3 py-2 text-xs ${phaseColor(item, phase)}`}
          >
            {PHASE_LABELS[item]}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-zinc-300">
          <p className="text-zinc-500">Patterns</p>
          <p className="text-base font-semibold text-zinc-100">{patterns}</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-zinc-300">
          <p className="text-zinc-500">Rules</p>
          <p className="text-base font-semibold text-zinc-100">{rules}</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-zinc-300">
          <p className="text-zinc-500">Salience</p>
          <p className="text-base font-semibold text-zinc-100">{salienceUpdates}</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-zinc-300">
          <p className="text-zinc-500">Conflicts</p>
          <p className="text-base font-semibold text-zinc-100">{contradictions}</p>
        </div>
      </div>
    </section>
  );
}
