"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { entryDelay } from "@/lib/feed/entry-delay";

interface ReasoningCardProps {
  text: string;
  isActive: boolean;
  eventId?: string;
  index: number;
}

export function ReasoningCard({ text, isActive, eventId, index }: ReasoningCardProps) {
  const textContainerRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isActive || !textContainerRef.current) {
      return;
    }

    textContainerRef.current.scrollTo({
      top: textContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [isActive, text]);

  useEffect(() => {
    if (isActive) {
      const collapseTimer = setTimeout(() => {
        setExpanded(false);
      }, 0);

      return () => {
        clearTimeout(collapseTimer);
      };
    }
  }, [isActive]);

  const showCollapsedText = !isActive && text.length > 0 && !expanded;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        damping: 24,
        stiffness: 180,
        delay: entryDelay(eventId ?? `reasoning-${index}`, index),
      }}
      className="space-y-3 rounded-lg border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 p-3 [contain-intrinsic-size:220px] [content-visibility:auto]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-indigo-200">
          {isActive ? "Thinking..." : "Analysis complete"}
        </p>
        {isActive ? (
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            className="h-2.5 w-2.5 rounded-full bg-indigo-300"
            aria-label="Reasoning in progress"
          />
        ) : null}
      </div>

      <div
        ref={textContainerRef}
        className={`relative rounded-md border border-indigo-500/20 bg-zinc-950/40 p-2 ${showCollapsedText ? "max-h-20 overflow-hidden" : isActive ? "max-h-36 overflow-auto" : ""}`}
      >
        <pre className="whitespace-pre-wrap break-words text-xs font-mono text-indigo-100/90">
          {text || "Waiting for model reasoning..."}
        </pre>
        {showCollapsedText ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-950/90 to-transparent" />
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {showCollapsedText ? (
          <motion.button
            type="button"
            onClick={() => setExpanded(true)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="mt-1 text-[10px] text-indigo-300/70 transition hover:text-indigo-200"
          >
            Show full analysis
          </motion.button>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
