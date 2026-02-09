"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";

import { ActivityCard, type ActivityEventView } from "@/components/feed/ActivityCard";
import { PRGroupCard } from "@/components/feed/PRGroupCard";
import { RuleGroupCard } from "@/components/feed/RuleGroupCard";
import { getColorFamilyForPatternKey, getColorFamilyForRule } from "@/lib/color/cluster-palette";
import type { AssociatedRuleGroup } from "@/lib/feed/association-state";
import { activityEventMatchesNodeId, buildFeedRenderWindow, type SelectionSource } from "@/lib/feed/cross-selection";
import { PATTERN_KEYS, type PatternKey } from "@/lib/memory/pattern-taxonomy";

interface TwoColumnFeedProps {
  unassociated: ActivityEventView[];
  associated: AssociatedRuleGroup[];
  maxItems?: number;
  selectedNodeId?: string | null;
  selectionSource?: SelectionSource | null;
  onSelectEvent?: (event: ActivityEventView) => void;
}

const CARD_LAYOUT_TRANSITION = {
  layout: {
    type: "spring",
    stiffness: 120,
    damping: 20,
    mass: 0.9,
  },
} as const;

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

function normalizePatternKey(value: unknown): PatternKey | null {
  if (typeof value !== "string") {
    return null;
  }

  if (!PATTERN_KEYS.includes(value as PatternKey)) {
    return null;
  }

  return value as PatternKey;
}

function renderEventCard({
  event,
  index,
  selectedNodeId,
  pinnedFromGraph = false,
  onSelectEvent,
}: {
  event: ActivityEventView;
  index: number;
  selectedNodeId: string | null;
  pinnedFromGraph?: boolean;
  onSelectEvent?: (event: ActivityEventView) => void;
}) {
  const groupedEpisodes = event.groupedEpisodes;
  const selected = activityEventMatchesNodeId(event, selectedNodeId);

  if (groupedEpisodes && groupedEpisodes.length > 0) {
    return (
      <PRGroupCard
        prNumber={numberFromUnknown(event.raw.pr_number) ?? 0}
        prTitle={
          typeof event.raw.pr_title === "string" && event.raw.pr_title.trim().length > 0 ? event.raw.pr_title : event.title
        }
        episodes={groupedEpisodes}
        index={index}
        selected={selected}
        pinnedFromGraph={pinnedFromGraph}
        selectedEpisodeId={
          selectedNodeId
            ? groupedEpisodes.find((episode) => activityEventMatchesNodeId(episode, selectedNodeId))?.id ?? null
            : null
        }
        onSelectEpisode={onSelectEvent}
      />
    );
  }

  if (event.type === "rule_promoted" && typeof event.graphNodeId === "string" && event.graphNodeId.length > 0) {
    return (
      <RuleGroupCard
        ruleTitle={
          typeof event.raw.title === "string" && event.raw.title.trim().length > 0 ? event.raw.title : event.title
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
        pinnedFromGraph={pinnedFromGraph}
        graphNodeId={event.graphNodeId}
        rulePatternKey={
          typeof event.raw.rule_key === "string" && event.raw.rule_key.trim().length > 0 ? event.raw.rule_key : undefined
        }
        onSelect={onSelectEvent ? () => onSelectEvent(event) : undefined}
      />
    );
  }

  return (
    <ActivityCard
      event={event}
      index={index}
      selected={selected}
      pinnedFromGraph={pinnedFromGraph}
      onSelect={onSelectEvent}
    />
  );
}

export function TwoColumnFeed({
  unassociated,
  associated,
  maxItems = 12,
  selectedNodeId = null,
  selectionSource = null,
  onSelectEvent,
}: TwoColumnFeedProps) {
  const eventElementMapRef = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const ruleHeaderMapRef = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const { events: visibleUnassociated, pinnedEventId } = useMemo(
    () =>
      buildFeedRenderWindow({
        events: unassociated,
        maxItems,
        selectedNodeId,
        source: selectionSource,
      }),
    [maxItems, selectedNodeId, selectionSource, unassociated],
  );

  useEffect(() => {
    if (!selectedNodeId || selectionSource !== "graph") {
      return;
    }

    const selectedUnassociated = visibleUnassociated.find((entry) => activityEventMatchesNodeId(entry, selectedNodeId));
    if (selectedUnassociated) {
      const element = eventElementMapRef.current.get(selectedUnassociated.id);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    for (const group of associated) {
      if (group.ruleId === selectedNodeId) {
        const header = ruleHeaderMapRef.current.get(group.ruleId);
        header?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (group.ruleEvent && activityEventMatchesNodeId(group.ruleEvent, selectedNodeId)) {
        const element = eventElementMapRef.current.get(group.ruleEvent.id);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const selectedEpisode = group.episodes.find((episode) => activityEventMatchesNodeId(episode, selectedNodeId));
      if (!selectedEpisode) {
        continue;
      }

      const element = eventElementMapRef.current.get(selectedEpisode.id);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
  }, [associated, selectedNodeId, selectionSource, visibleUnassociated]);

  return (
    <LayoutGroup id="two-column-feed">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <section className="space-y-2">
          <h3 className="px-1 text-[10px] font-medium uppercase tracking-widest text-zinc-500">Unassociated</h3>
          <div className="max-h-[500px] space-y-2 overflow-auto pr-1">
            <AnimatePresence initial={false}>
              {visibleUnassociated.length === 0 ? (
                <p className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-400">
                  Waiting for unassociated activity...
                </p>
              ) : (
                visibleUnassociated.map((event, index) => (
                  <motion.div
                    key={event.id}
                    layout
                    layoutId={event.id}
                    transition={CARD_LAYOUT_TRANSITION}
                    ref={(element) => {
                      eventElementMapRef.current.set(event.id, element);
                    }}
                    data-activity-event-id={event.id}
                  >
                    {renderEventCard({
                      event,
                      index,
                      selectedNodeId,
                      pinnedFromGraph: pinnedEventId === event.id,
                      onSelectEvent,
                    })}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="px-1 text-[10px] font-medium uppercase tracking-widest text-zinc-500">Associated</h3>
          <div className="max-h-[500px] space-y-3 overflow-auto pr-1">
            <AnimatePresence initial={false}>
              {associated.length === 0 ? (
                <p className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-400">
                  Promoted rules will appear here.
                </p>
              ) : (
                associated.map((group) => {
                  const groupPatternKey = normalizePatternKey(group.rulePatternKey);
                  const colorFamily = groupPatternKey
                    ? getColorFamilyForPatternKey(groupPatternKey)
                    : getColorFamilyForRule(group.ruleId);
                  const selectedRule = selectedNodeId === group.ruleId;

                  return (
                    <div key={group.ruleId} className="space-y-2">
                      <div
                        ref={(element) => {
                          ruleHeaderMapRef.current.set(group.ruleId, element);
                        }}
                        className={`rounded-sm border-l-2 bg-zinc-900/30 px-2 py-1 text-xs font-medium ${
                          selectedRule ? "ring-1 ring-offset-0" : ""
                        }`}
                        style={{
                          borderColor: colorFamily.accent,
                          color: colorFamily.textMuted,
                          ...(selectedRule
                            ? {
                                boxShadow: `inset 0 0 0 1px ${colorFamily.accent}33`,
                              }
                            : {}),
                        }}
                      >
                        {group.ruleTitle}
                      </div>

                      {group.ruleEvent ? (
                        <motion.div
                          key={group.ruleEvent.id}
                          layout
                          layoutId={group.ruleEvent.id}
                          transition={CARD_LAYOUT_TRANSITION}
                          ref={(element) => {
                            eventElementMapRef.current.set(group.ruleEvent!.id, element);
                          }}
                          data-activity-event-id={group.ruleEvent.id}
                        >
                          {renderEventCard({
                            event: group.ruleEvent,
                            index: 0,
                            selectedNodeId,
                            onSelectEvent,
                          })}
                        </motion.div>
                      ) : null}

                      {group.episodes.map((event, index) => (
                        <motion.div
                          key={event.id}
                          layout
                          layoutId={event.id}
                          transition={CARD_LAYOUT_TRANSITION}
                          ref={(element) => {
                            eventElementMapRef.current.set(event.id, element);
                          }}
                          data-activity-event-id={event.id}
                        >
                          {renderEventCard({
                            event,
                            index: index + 1,
                            selectedNodeId,
                            onSelectEvent,
                          })}
                        </motion.div>
                      ))}
                    </div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </LayoutGroup>
  );
}
