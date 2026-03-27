"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface CollapsiblePhaseSectionProps {
  isActive: boolean;
  isComplete: boolean;
  summary: ReactNode;
  label?: string;
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
  label,
  children,
  className,
}: CollapsiblePhaseSectionProps) {
  const [userExpanded, setUserExpanded] = useState(false);

  useEffect(() => {
    if (isActive) {
      const collapseTimer = setTimeout(() => {
        setUserExpanded(false);
      }, 0);

      return () => {
        clearTimeout(collapseTimer);
      };
    }
  }, [isActive]);

  if (!isActive && !isComplete) {
    return null;
  }

  const showChildren = isActive || (isComplete && userExpanded);
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
          {label ? <p className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</p> : null}
          <button
            type="button"
            onClick={() => setUserExpanded((current) => !current)}
            aria-expanded={userExpanded}
            className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800/40"
          >
            <span>{summary}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${userExpanded ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {showChildren ? (
              <motion.div
                key="children"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={SECTION_TRANSITION}
                className="overflow-hidden"
              >
                {children}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
