"use client";

import { useMemo, useState } from "react";

import { EpisodeDetail } from "@/components/episodes/EpisodeDetail";
import { EpisodeList } from "@/components/episodes/EpisodeList";

interface EpisodeViewModel {
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

interface EpisodesExplorerProps {
  episodes: EpisodeViewModel[];
}

export function EpisodesExplorer({ episodes }: EpisodesExplorerProps) {
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(episodes[0]?.id ?? null);

  const selectedEpisode = useMemo(
    () => episodes.find((episode) => episode.id === selectedEpisodeId) ?? null,
    [episodes, selectedEpisodeId],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.5fr]">
      <div className="max-h-[72vh] overflow-auto pr-1">
        <EpisodeList
          episodes={episodes.map((episode) => ({
            id: episode.id,
            title: episode.title,
            repoFullName: episode.repoFullName,
            salience: episode.salience,
            pattern: episode.pattern ?? "unknown",
            happenedAt: episode.happenedAt,
          }))}
          selectedEpisodeId={selectedEpisodeId}
          onSelectEpisode={setSelectedEpisodeId}
        />
      </div>

      <EpisodeDetail episode={selectedEpisode} />
    </div>
  );
}
