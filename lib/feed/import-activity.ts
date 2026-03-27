import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { graphNodeIdFromImportEvent } from "@/lib/feed/cross-selection";
import { patternDisplayLabel } from "@/lib/feed/narrative-partition";
import type { ImportEvent } from "@/lib/github/types";

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function importEventPrNumber(raw: Record<string, unknown>): number | null {
  const topLevel = numberFromUnknown(raw.pr_number);
  if (topLevel !== null) {
    return topLevel;
  }

  const nestedEpisode = raw.episode;
  if (!nestedEpisode || typeof nestedEpisode !== "object") {
    return null;
  }

  return numberFromUnknown((nestedEpisode as Record<string, unknown>).source_pr_number);
}

function importPrTitle(event: ActivityEventView) {
  const rawTitle = event.raw.title;
  if (typeof rawTitle === "string" && rawTitle.trim().length > 0) {
    return rawTitle;
  }

  if (typeof event.subtitle === "string" && event.subtitle.trim().length > 0) {
    return event.subtitle;
  }

  return "Untitled PR";
}

export function toImportActivityEvent(event: ImportEvent, index: number): ActivityEventView | null {
  const prefix = `${event.type}-${index}`;

  if (event.type === "replay_manifest") {
    return null;
  }

  if (event.type === "pr_found") {
    return {
      id: prefix,
      type: event.type,
      title: `Discovered ${String(event.data.count ?? 0)} merged pull requests`,
      raw: event.data,
    };
  }

  if (event.type === "encoding_start") {
    return {
      id: prefix,
      type: event.type,
      title: `Encoding PR #${String(event.data.pr_number ?? "?")}`,
      subtitle: String(event.data.title ?? "Untitled PR"),
      raw: event.data,
    };
  }

  if (event.type === "snippets_extracted") {
    const snippetCount = numberFromUnknown(event.data.snippet_count);
    const fileCount = numberFromUnknown(event.data.file_count);
    const searchRuleCount = numberFromUnknown(event.data.search_rule_count);

    return {
      id: prefix,
      type: event.type,
      title: `Extracted ${String(snippetCount ?? "?")} snippets from ${String(fileCount ?? "?")} files`,
      subtitle:
        searchRuleCount !== null
          ? `${searchRuleCount} search rule${searchRuleCount === 1 ? "" : "s"} applied`
          : undefined,
      variant: "import",
      raw: event.data,
    };
  }

  if (event.type === "episode_created") {
    const episode = event.data.episode as
      | {
          id?: string;
          title?: string;
          salience_score?: number;
          the_pattern?: string;
          triggers?: string[];
          what_happened?: string;
          the_fix?: string;
          why_it_matters?: string;
        }
      | undefined;

    const reduction = event.data.token_reduction as
      | { reductionRatio?: number; rawTokens?: number; reducedTokens?: number }
      | undefined;

    const ratio = reduction?.reductionRatio ?? 0;

    return {
      id: prefix,
      type: event.type,
      title: episode?.title ?? "Episode created",
      subtitle: patternDisplayLabel(episode?.the_pattern),
      salience: Number(episode?.salience_score ?? 0),
      triggers: Array.isArray(episode?.triggers) ? episode.triggers : [],
      whatHappened: typeof episode?.what_happened === "string" ? episode.what_happened : undefined,
      theFix: typeof episode?.the_fix === "string" ? episode.the_fix : undefined,
      whyItMatters: typeof episode?.why_it_matters === "string" ? episode.why_it_matters : undefined,
      graphNodeId: graphNodeIdFromImportEvent(event) ?? undefined,
      snippet:
        reduction && typeof ratio === "number"
          ? `token reduction ${(ratio * 100).toFixed(0)}% (${reduction.reducedTokens}/${reduction.rawTokens})`
          : undefined,
      raw: event.data,
    };
  }

  if (event.type === "episode_skipped") {
    return {
      id: prefix,
      type: event.type,
      title: `Skipped PR #${String(event.data.pr_number ?? "?")}`,
      subtitle: `${String(event.data.title ?? "Untitled PR")} — already imported`,
      raw: event.data,
    };
  }

  if (event.type === "encoding_error") {
    return {
      id: prefix,
      type: event.type,
      title: `Import error on PR #${String(event.data.pr_number ?? "?")}`,
      subtitle: String(event.data.message ?? "Unknown error"),
      raw: event.data,
    };
  }

  const failed = Number(event.data.failed ?? 0);
  return {
    id: prefix,
    type: event.type,
    title: `Import complete: ${String(event.data.total ?? 0)} episodes created`,
    subtitle: failed > 0 ? `${failed} PR(s) failed encoding` : undefined,
    variant: "import",
    raw: event.data,
  };
}

export function groupImportActivityEvents(importActivityEvents: ActivityEventView[]): ActivityEventView[] {
  const grouped: ActivityEventView[] = [];

  let index = 0;
  while (index < importActivityEvents.length) {
    const current = importActivityEvents[index]!;

    if (current.type !== "encoding_start") {
      grouped.push(current);
      index += 1;
      continue;
    }

    const prNumber = importEventPrNumber(current.raw);
    if (prNumber === null) {
      grouped.push(current);
      index += 1;
      continue;
    }

    const episodes: ActivityEventView[] = [];
    let cursor = index + 1;

    while (cursor < importActivityEvents.length) {
      const candidate = importActivityEvents[cursor]!;
      if (candidate.type !== "episode_created") {
        break;
      }

      const candidatePr = importEventPrNumber(candidate.raw);
      if (candidatePr !== prNumber) {
        break;
      }

      episodes.push(candidate);
      cursor += 1;
    }

    if (episodes.length === 0) {
      grouped.push(current);
      index += 1;
      continue;
    }

    // Keep single-episode imports as episode cards to avoid collapsing all activity into PR wrappers.
    if (episodes.length === 1) {
      grouped.push(episodes[0]!);
      index = cursor;
      continue;
    }

    const salienceValues = episodes
      .map((episode) => episode.salience)
      .filter((salience): salience is number => typeof salience === "number");
    const averageSalience =
      salienceValues.length > 0
        ? Math.round((salienceValues.reduce((sum, value) => sum + value, 0) / salienceValues.length) * 10) / 10
        : undefined;

    const graphNodeIds = episodes
      .map((episode) => episode.graphNodeId)
      .filter((graphNodeId): graphNodeId is string => typeof graphNodeId === "string" && graphNodeId.length > 0);

    const prTitle = importPrTitle(current);

    grouped.push({
      id: `pr-group-${prNumber}-${current.id}`,
      type: "pr_group",
      title: `PR #${prNumber}: ${prTitle}`,
      subtitle: `${episodes.length} episode${episodes.length === 1 ? "" : "s"} imported`,
      salience: averageSalience,
      groupedEpisodes: episodes,
      graphNodeId: graphNodeIds[0],
      graphNodeIds: graphNodeIds.length > 0 ? graphNodeIds : undefined,
      variant: "import",
      raw: {
        pr_number: prNumber,
        pr_title: prTitle,
        episode_count: episodes.length,
      },
    });

    index = cursor;
  }

  return grouped;
}
