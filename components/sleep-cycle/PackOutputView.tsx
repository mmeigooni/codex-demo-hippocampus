"use client";

import type { ConsolidationModelOutput } from "@/lib/codex/types";

interface PackOutputViewProps {
  pack: ConsolidationModelOutput | null;
}

export function PackOutputView({ pack }: PackOutputViewProps) {
  if (!pack) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        No pack output yet. Complete a consolidation run to generate promoted rules and supporting evidence.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">Promoted rules</h3>
        {pack.rules_to_promote.length === 0 ? (
          <p className="text-sm text-zinc-400">No rules promoted in this run.</p>
        ) : (
          pack.rules_to_promote.map((rule) => (
            <article key={rule.title} className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-sm font-semibold text-zinc-100">{rule.title}</p>
              <p className="mt-1 text-xs text-zinc-300">{rule.description}</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                sources: {rule.source_episode_ids.length} • triggers: {rule.triggers.join(", ")}
              </p>
            </article>
          ))
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">Contradictions</h3>
        {pack.contradictions.length === 0 ? (
          <p className="text-sm text-zinc-400">No contradictions detected.</p>
        ) : (
          pack.contradictions.map((item, index) => (
            <article
              key={`${item.left_episode_id}-${item.right_episode_id}-${index}`}
              className="rounded-md border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100"
            >
              <p>{item.reason}</p>
              <p className="mt-1 text-[11px] text-amber-200/80">
                {item.left_episode_id} ↔ {item.right_episode_id}
              </p>
            </article>
          ))
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">Salience deltas</h3>
        {pack.salience_updates.length === 0 ? (
          <p className="text-sm text-zinc-400">No salience updates emitted.</p>
        ) : (
          pack.salience_updates.map((update) => (
            <article key={update.episode_id} className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-xs text-zinc-200">
                {update.episode_id} → salience {update.salience_score}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">{update.reason}</p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
