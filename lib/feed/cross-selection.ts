import type { ConsolidationEvent } from "@/lib/codex/types";
import type { ImportEvent } from "@/lib/github/types";

export type SelectionSource = "feed" | "graph";

export interface GraphLinkedActivityEvent {
  id: string;
  graphNodeId?: string;
  graphNodeIds?: string[];
}

export function activityEventMatchesNodeId<TEvent extends GraphLinkedActivityEvent>(
  event: TEvent,
  selectedNodeId: string | null,
) {
  if (!selectedNodeId) {
    return false;
  }

  if (event.graphNodeId === selectedNodeId) {
    return true;
  }

  return Array.isArray(event.graphNodeIds) && event.graphNodeIds.includes(selectedNodeId);
}

export function graphNodeIdFromImportEvent(event: ImportEvent): string | null {
  if (event.type !== "episode_created") {
    return null;
  }

  const data = event.data as { episode?: { id?: unknown } };
  const episodeId = data.episode?.id;

  if (typeof episodeId !== "string" || episodeId.length === 0) {
    return null;
  }

  return `episode-${episodeId}`;
}

export function graphNodeIdFromConsolidationEvent(event: ConsolidationEvent): string | null {
  const data = event.data as Record<string, unknown>;

  if (event.type === "rule_promoted") {
    const ruleId = data.rule_id;
    if (typeof ruleId === "string" && ruleId.length > 0) {
      return `rule-${ruleId}`;
    }

    return null;
  }

  if (event.type === "salience_updated") {
    const episodeId = data.episode_id;
    if (typeof episodeId === "string" && episodeId.length > 0) {
      return `episode-${episodeId}`;
    }

    return null;
  }

  return null;
}

export function buildFeedRenderWindow<TEvent extends GraphLinkedActivityEvent>({
  events,
  maxItems,
  selectedNodeId,
  source,
}: {
  events: TEvent[];
  maxItems: number;
  selectedNodeId: string | null;
  source: SelectionSource | null;
}) {
  const visible = events.slice(0, maxItems);

  if (!selectedNodeId || source !== "graph") {
    return {
      events: visible,
      pinnedEventId: null as string | null,
    };
  }

  const selectedEvent = events.find((event) => activityEventMatchesNodeId(event, selectedNodeId)) ?? null;

  if (!selectedEvent) {
    return {
      events: visible,
      pinnedEventId: null as string | null,
    };
  }

  if (visible.some((event) => event.id === selectedEvent.id)) {
    return {
      events: visible,
      pinnedEventId: null as string | null,
    };
  }

  const dedupedVisible = visible.filter((event) => event.id !== selectedEvent.id);

  return {
    events: [selectedEvent, ...dedupedVisible].slice(0, maxItems),
    pinnedEventId: selectedEvent.id,
  };
}
