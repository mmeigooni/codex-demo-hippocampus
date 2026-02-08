"use client";

interface EpisodeListItem {
  id: string;
  title: string;
  repoFullName: string;
  salience: number;
  pattern: string;
  happenedAt: string | null;
}

interface EpisodeListProps {
  episodes: EpisodeListItem[];
  selectedEpisodeId: string | null;
  onSelectEpisode: (episodeId: string) => void;
}

export function EpisodeList({ episodes, selectedEpisodeId, onSelectEpisode }: EpisodeListProps) {
  if (episodes.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        No episodes yet. Import a repository from the dashboard to populate memory.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {episodes.map((episode) => {
        const isActive = episode.id === selectedEpisodeId;

        return (
          <button
            key={episode.id}
            type="button"
            onClick={() => onSelectEpisode(episode.id)}
            className={`w-full rounded-lg border p-3 text-left transition ${
              isActive
                ? "border-cyan-400/60 bg-cyan-500/10"
                : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60"
            }`}
          >
            <p className="text-sm font-semibold text-zinc-100">{episode.title}</p>
            <p className="mt-1 text-xs text-zinc-400">{episode.repoFullName}</p>
            <p className="mt-2 text-xs text-zinc-300">
              pattern: {episode.pattern} • salience: {episode.salience}
            </p>
            {episode.happenedAt ? (
              <p className="mt-1 text-[11px] text-zinc-500">
                happened: {new Date(episode.happenedAt).toLocaleString()}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
