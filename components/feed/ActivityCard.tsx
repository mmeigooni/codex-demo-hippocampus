"use client";

import { motion } from "motion/react";

import { CodeSnippet } from "@/components/feed/CodeSnippet";
import { SalienceBadge } from "@/components/feed/SalienceBadge";
import { TriggerPill } from "@/components/feed/TriggerPill";

export interface ActivityEventView {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  salience?: number;
  triggers?: string[];
  snippet?: string;
  raw: Record<string, unknown>;
}

interface ActivityCardProps {
  event: ActivityEventView;
  index: number;
}

export function ActivityCard({ event, index }: ActivityCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: index * 0.04 }}
      className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-cyan-300">{event.type}</p>
        {event.salience !== undefined ? <SalienceBadge salience={event.salience} /> : null}
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-100">{event.title}</p>
        {event.subtitle ? <p className="text-xs text-zinc-400">{event.subtitle}</p> : null}
      </div>

      {event.triggers && event.triggers.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {event.triggers.map((trigger) => (
            <TriggerPill key={`${event.id}-${trigger}`} trigger={trigger} />
          ))}
        </div>
      ) : null}

      {event.snippet ? <CodeSnippet snippet={event.snippet} /> : null}
    </motion.article>
  );
}
