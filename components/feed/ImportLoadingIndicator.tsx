"use client";

import { AnimatePresence, motion } from "motion/react";

interface ImportLoadingIndicatorProps {
  statusText?: string | null;
}

export function ImportLoadingIndicator({ statusText = null }: ImportLoadingIndicatorProps) {
  return (
    <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center">
        <span className="text-sm text-zinc-400">Reading code reviews</span>
        {[0, 1, 2].map((step) => (
          <motion.span
            key={step}
            className="ml-0.5 inline-block h-1 w-1 rounded-full bg-zinc-500"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
            transition={{
              duration: 1.2,
              repeat: Number.POSITIVE_INFINITY,
              delay: step * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {statusText ? (
          <motion.p
            key={statusText}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="truncate text-xs text-cyan-200/70"
          >
            {statusText}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
