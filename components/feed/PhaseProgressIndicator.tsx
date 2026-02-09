"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";

import type { NarrativePhase } from "@/lib/feed/narrative-partition";

interface PhaseProgressIndicatorProps {
  phase: NarrativePhase;
}

const STEPS = [
  { key: "observing", label: "Observing" },
  { key: "analyzing", label: "Analyzing" },
  { key: "connecting", label: "Connecting" },
] as const;

const PHASE_INDEX: Record<(typeof STEPS)[number]["key"], number> = {
  observing: 0,
  analyzing: 1,
  connecting: 2,
};

export function PhaseProgressIndicator({ phase }: PhaseProgressIndicatorProps) {
  const currentIndex = PHASE_INDEX[phase];

  return (
    <div className="flex h-7 items-center gap-2">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isActive = index === currentIndex;

        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {isCompleted ? (
                <div className="flex h-3 w-3 items-center justify-center rounded-full bg-cyan-400 text-zinc-950">
                  <Check className="h-2 w-2" strokeWidth={2.8} aria-hidden="true" />
                </div>
              ) : isActive ? (
                <motion.div
                  className="h-3 w-3 rounded-full border border-cyan-400 bg-cyan-400/10"
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
              ) : (
                <div className="h-3 w-3 rounded-full border border-zinc-700" />
              )}
              <span className="text-[10px] uppercase tracking-wide text-zinc-400">{step.label}</span>
            </div>

            {index < STEPS.length - 1 ? (
              <div className="h-px w-8 overflow-hidden rounded bg-zinc-800">
                <motion.div
                  className="h-full bg-cyan-400"
                  initial={false}
                  animate={{ width: currentIndex > index ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
