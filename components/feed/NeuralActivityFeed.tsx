"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence } from "motion/react";

import { ActivityCard, type ActivityEventView } from "@/components/feed/ActivityCard";
import { PRGroupCard } from "@/components/feed/PRGroupCard";
import { RuleGroupCard } from "@/components/feed/RuleGroupCard";
import { activityEventMatchesNodeId, buildFeedRenderWindow, type SelectionSource } from "@/lib/feed/cross-selection";

interface NeuralActivityFeedProps {
  events: ActivityEventView[];
  maxItems?: number;
  selectedNodeId?: string | null;
  selectionSource?: SelectionSource | null;
  onSelectEvent?: (event: ActivityEventView) => void;
}

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

export function NeuralActivityFeed({
  events,
  maxItems = 12,
  selectedNodeId = null,
  selectionSource = null,
  onSelectEvent,
}: NeuralActivityFeedProps) {
  const eventElementMapRef = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const { events: visibleEvents, pinnedEventId } = useMemo(
    () =>
      buildFeedRenderWindow({
        events,
        maxItems,
        selectedNodeId,
        source: selectionSource,
      }),
    [events, maxItems, selectedNodeId, selectionSource],
  );

  useEffect(() => {
    if (!selectedNodeId || selectionSource !== "graph") {
      return;
    }

    const selectedEvent = visibleEvents.find((event) => activityEventMatchesNodeId(event, selectedNodeId));
    if (!selectedEvent) {
      return;
    }

    const element = eventElementMapRef.current.get(selectedEvent.id);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedNodeId, selectionSource, visibleEvents]);

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {visibleEvents.length === 0 ? (
          <p className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-400">
            Waiting for neural activity...
          </p>
        ) : (
          visibleEvents.map((event, index) => {
            const groupedEpisodes = event.groupedEpisodes;
            const selected = activityEventMatchesNodeId(event, selectedNodeId);

            return (
              <div
                key={event.id}
                ref={(element) => {
                  eventElementMapRef.current.set(event.id, element);
                }}
                data-activity-event-id={event.id}
              >
                {groupedEpisodes && groupedEpisodes.length > 0 ? (
                  <PRGroupCard
                    prNumber={numberFromUnknown(event.raw.pr_number) ?? 0}
                    prTitle={
                      typeof event.raw.pr_title === "string" && event.raw.pr_title.trim().length > 0
                        ? event.raw.pr_title
                        : event.title
                    }
                    episodes={groupedEpisodes}
                    index={index}
                    selected={selected}
                    pinnedFromGraph={pinnedEventId === event.id}
                    selectedEpisodeId={
                      selectedNodeId
                        ? groupedEpisodes.find((episode) => activityEventMatchesNodeId(episode, selectedNodeId))?.id ?? null
                        : null
                    }
                    onSelectEpisode={onSelectEvent}
                  />
                ) : event.type === "rule_promoted" && typeof event.graphNodeId === "string" && event.graphNodeId.length > 0 ? (
                  <RuleGroupCard
                    ruleTitle={
                      typeof event.raw.title === "string" && event.raw.title.trim().length > 0
                        ? event.raw.title
                        : event.title
                    }
                    ruleId={
                      typeof event.raw.rule_id === "string" && event.raw.rule_id.trim().length > 0
                        ? event.raw.rule_id
                        : event.graphNodeId
                    }
                    confidence={numberFromUnknown(event.raw.confidence) ?? undefined}
                    triggers={event.triggers}
                    episodeCount={numberFromUnknown(event.raw.episode_count) ?? undefined}
                    index={index}
                    selected={selected}
                    pinnedFromGraph={pinnedEventId === event.id}
                    graphNodeId={event.graphNodeId}
                    onSelect={onSelectEvent ? () => onSelectEvent(event) : undefined}
                  />
                ) : (
                  <ActivityCard
                    event={event}
                    index={index}
                    selected={selected}
                    pinnedFromGraph={pinnedEventId === event.id}
                    onSelect={onSelectEvent}
                  />
                )}
              </div>
            );
          })
        )}
      </AnimatePresence>
    </div>
  );
}
