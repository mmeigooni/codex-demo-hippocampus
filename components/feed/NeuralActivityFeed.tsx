"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence } from "motion/react";

import { ActivityCard, type ActivityEventView } from "@/components/feed/ActivityCard";
import { buildFeedRenderWindow, type SelectionSource } from "@/lib/feed/cross-selection";

interface NeuralActivityFeedProps {
  events: ActivityEventView[];
  maxItems?: number;
  selectedNodeId?: string | null;
  selectionSource?: SelectionSource | null;
  onSelectEvent?: (event: ActivityEventView) => void;
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

    const selectedEvent = visibleEvents.find((event) => event.graphNodeId === selectedNodeId);
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
          visibleEvents.map((event, index) => (
            <div
              key={event.id}
              ref={(element) => {
                eventElementMapRef.current.set(event.id, element);
              }}
              data-activity-event-id={event.id}
            >
              <ActivityCard
                event={event}
                index={index}
                selected={Boolean(selectedNodeId && event.graphNodeId === selectedNodeId)}
                pinnedFromGraph={pinnedEventId === event.id}
                onSelect={onSelectEvent}
              />
            </div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}
