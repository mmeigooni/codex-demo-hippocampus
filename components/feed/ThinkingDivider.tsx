"use client";

import { motion } from "motion/react";

interface ThinkingDividerProps {
  label?: string;
  active?: boolean;
}

export function ThinkingDivider({ label = "Thinking", active = false }: ThinkingDividerProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex items-center gap-3 py-2"
    >
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-zinc-700" />
      {active ? (
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((step) => (
            <motion.span
              key={step}
              className="h-1 w-1 rounded-full bg-zinc-500"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: step * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      ) : (
        <span className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</span>
      )}
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-zinc-700" />
    </motion.div>
  );
}
