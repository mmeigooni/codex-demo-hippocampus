"use client";

interface EpisodeDetailModel {
  id: string;
  title: string;
  repoFullName: string;
  who: string | null;
  whatHappened: string | null;
  pattern: string | null;
  fix: string | null;
  whyItMatters: string | null;
  salience: number;
  triggers: string[];
  sourceUrl: string | null;
  happenedAt: string | null;
  sourcePrNumber: number | null;
}

interface EpisodeDetailProps {
  episode: EpisodeDetailModel | null;
}

export function EpisodeDetail({ episode }: EpisodeDetailProps) {
  if (!episode) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        Select an episode to inspect who/what/pattern/fix/why details.
      </div>
    );
  }

  return (
    <article className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-zinc-100">{episode.title}</h3>
        <p className="text-xs text-zinc-400">{episode.repoFullName}</p>
        <p className="text-xs text-zinc-500">
          salience {episode.salience}
          {episode.sourcePrNumber ? ` • PR #${episode.sourcePrNumber}` : ""}
          {episode.happenedAt ? ` • ${new Date(episode.happenedAt).toLocaleString()}` : ""}
        </p>
      </header>

      <section className="space-y-2 text-sm text-zinc-300">
        <p>
          <span className="font-semibold text-zinc-200">Who:</span> {episode.who ?? "unknown"}
        </p>
        <p>
          <span className="font-semibold text-zinc-200">What:</span> {episode.whatHappened ?? "not provided"}
        </p>
        <p>
          <span className="font-semibold text-zinc-200">Pattern:</span> {episode.pattern ?? "not provided"}
        </p>
        <p>
          <span className="font-semibold text-zinc-200">Fix:</span> {episode.fix ?? "not provided"}
        </p>
        <p>
          <span className="font-semibold text-zinc-200">Why it matters:</span>{" "}
          {episode.whyItMatters ?? "not provided"}
        </p>
      </section>

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Triggers</p>
        {episode.triggers.length === 0 ? (
          <p className="text-sm text-zinc-400">No triggers recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {episode.triggers.map((trigger) => (
              <span
                key={`${episode.id}-${trigger}`}
                className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
              >
                {trigger}
              </span>
            ))}
          </div>
        )}
      </section>

      {episode.sourceUrl ? (
        <a
          href={episode.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-sm text-cyan-300 hover:text-cyan-200"
        >
          Open source reference
        </a>
      ) : null}
    </article>
  );
}
