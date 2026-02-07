"use client";

import { AnimatePresence } from "motion/react";

import { ActivityCard, type ActivityEventView } from "@/components/feed/ActivityCard";

interface NeuralActivityFeedProps {
  events: ActivityEventView[];
  maxItems?: number;
}

export function NeuralActivityFeed({ events, maxItems = 12 }: NeuralActivityFeedProps) {
  const visible = events.slice(-maxItems).reverse();

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {visible.length === 0 ? (
          <p className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-400">
            Waiting for neural activity...
          </p>
        ) : (
          visible.map((event, index) => <ActivityCard key={event.id} event={event} index={index} />)
        )}
      </AnimatePresence>
    </div>
  );
}
