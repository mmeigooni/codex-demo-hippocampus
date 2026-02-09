"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

interface CollapsiblePhaseSectionProps {
  isActive: boolean;
  isComplete: boolean;
  summary: ReactNode;
  children: ReactNode;
  className?: string;
}

const SECTION_TRANSITION = {
  type: "spring",
  stiffness: 120,
  damping: 20,
  mass: 0.9,
} as const;

export function CollapsiblePhaseSection({
  isActive,
  isComplete,
  summary,
  children,
  className,
}: CollapsiblePhaseSectionProps) {
  if (!isActive && !isComplete) {
    return null;
  }

  const containerClassName = className ? `overflow-hidden ${className}` : "overflow-hidden";

  return (
    <AnimatePresence initial={false} mode="wait">
      {isActive ? (
        <motion.div
          key="full"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={SECTION_TRANSITION}
          className={containerClassName}
        >
          {children}
        </motion.div>
      ) : (
        <motion.div
          key="summary"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={SECTION_TRANSITION}
          className={containerClassName}
        >
          <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">{summary}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
