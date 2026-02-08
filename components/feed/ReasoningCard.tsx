"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";

interface ReasoningCardProps {
  text: string;
  isActive: boolean;
  index: number;
}

export function ReasoningCard({ text, isActive, index }: ReasoningCardProps) {
  const textContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!textContainerRef.current) {
      return;
    }

    textContainerRef.current.scrollTo({
      top: textContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [text]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: index * 0.04 }}
      className="space-y-3 rounded-lg border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 p-3 [contain-intrinsic-size:220px] [content-visibility:auto]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-indigo-200">reasoning</p>
        {isActive ? (
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            className="h-2.5 w-2.5 rounded-full bg-indigo-300"
            aria-label="Reasoning in progress"
          />
        ) : null}
      </div>

      {!isActive && text ? (
        <p className="text-xs text-indigo-100/80">Reasoning complete ({text.length} chars)</p>
      ) : (
        <div ref={textContainerRef} className="max-h-36 overflow-auto rounded-md border border-indigo-500/20 bg-zinc-950/40 p-2">
          <pre className="whitespace-pre-wrap break-words text-xs font-mono text-indigo-100/90">
            {text || "Waiting for model reasoning..."}
          </pre>
        </div>
      )}
    </motion.article>
  );
}
