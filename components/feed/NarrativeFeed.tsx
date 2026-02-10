"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Eye, Search, Sparkles } from "lucide-react";

import { ActivityCard, type ActivityEventView } from "@/components/feed/ActivityCard";
import { CollapsiblePhaseSection } from "@/components/feed/CollapsiblePhaseSection";
import { ImportLoadingIndicator } from "@/components/feed/ImportLoadingIndicator";
import { ObservationRow } from "@/components/feed/ObservationRow";
import { PatternRow } from "@/components/feed/PatternRow";
import { PhaseProgressIndicator } from "@/components/feed/PhaseProgressIndicator";
import type { AssociatedRuleGroup } from "@/lib/feed/association-state";
import type { NarrativeSections } from "@/lib/feed/narrative-partition";
import { activityEventMatchesNodeId, buildFeedRenderWindow, type SelectionSource } from "@/lib/feed/cross-selection";

interface NarrativeFeedProps {
  sections: NarrativeSections;
  maxItems?: number;
  importStatusText?: string | null;
  importStarted?: boolean;
  selectedNodeId?: string | null;
  selectionSource?: SelectionSource | null;
  onSelectEvent?: (event: ActivityEventView) => void;
  onObservationIndexMap?: (map: Map<string, number>) => void;
}

interface InsightRow {
  group: AssociatedRuleGroup;
  event: ActivityEventView;
}

const CARD_LAYOUT_TRANSITION = {
  layout: {
    type: "spring",
    stiffness: 120,
    damping: 20,
    mass: 0.9,
  },
} as const;

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
  const selected = activityEventMatchesNodeId(event, selectedNodeId);

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

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <h3 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">
      {icon}
      <span>{title}</span>
    </h3>
  );
}

function insightTitle(ruleTitle: string): string {
  return ruleTitle;
}

export function NarrativeFeed({
  sections,
  maxItems = 12,
  importStatusText = null,
  importStarted,
  selectedNodeId = null,
  selectionSource = null,
  onSelectEvent,
  onObservationIndexMap,
}: NarrativeFeedProps) {
  const eventElementMapRef = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const { events: visibleObservations, pinnedEventId } = useMemo(
    () =>
      buildFeedRenderWindow({
        events: sections.observations,
        maxItems,
        selectedNodeId,
        source: selectionSource,
      }),
    [maxItems, sections.observations, selectedNodeId, selectionSource],
  );

  const insightRows = useMemo<InsightRow[]>(() => {
    return sections.insights.map((group) => {
      const episodeCount = group.episodes.length;
      const title = insightTitle(group.ruleTitle);

      if (group.ruleEvent) {
        return {
          group,
          event: {
            ...group.ruleEvent,
            title,
            graphNodeId:
              typeof group.ruleEvent.graphNodeId === "string" && group.ruleEvent.graphNodeId.length > 0
                ? group.ruleEvent.graphNodeId
                : group.ruleId,
          },
        };
      }

      return {
        group,
        event: {
          id: `insight-row-${group.ruleId}`,
          type: "rule_promoted",
          title,
          graphNodeId: group.ruleId,
          raw: {
            rule_id: group.ruleId.replace(/^rule-/, ""),
            title: group.ruleTitle,
            episode_count: episodeCount,
          },
        },
      };
    });
  }, [sections.insights]);

  const observationIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let observationIndex = 1;

    for (const event of sections.observations) {
      const graphNodeId = event.graphNodeId;
      if (typeof graphNodeId !== "string" || graphNodeId.length === 0 || map.has(graphNodeId)) {
        continue;
      }

      map.set(graphNodeId, observationIndex);
      observationIndex += 1;
    }

    return map;
  }, [sections.observations]);

  const isInsightSelected = (row: InsightRow): boolean => {
    if (!selectedNodeId) {
      return false;
    }

    if (selectedNodeId === row.group.ruleId) {
      return true;
    }

    if (activityEventMatchesNodeId(row.event, selectedNodeId)) {
      return true;
    }

    return row.group.episodes.some((episode) => activityEventMatchesNodeId(episode, selectedNodeId));
  };

  useEffect(() => {
    onObservationIndexMap?.(observationIndexMap);
  }, [observationIndexMap, onObservationIndexMap]);

  useEffect(() => {
    if (!selectedNodeId || selectionSource !== "graph") {
      return;
    }

    const selectedObservation = visibleObservations.find((entry) => activityEventMatchesNodeId(entry, selectedNodeId));
    if (selectedObservation) {
      const element = eventElementMapRef.current.get(selectedObservation.id);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const selectedMilestone = sections.milestones.find((entry) => activityEventMatchesNodeId(entry, selectedNodeId));
    if (selectedMilestone) {
      const element = eventElementMapRef.current.get(selectedMilestone.id);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (sections.reasoning && activityEventMatchesNodeId(sections.reasoning, selectedNodeId)) {
      const element = eventElementMapRef.current.get(sections.reasoning.id);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const selectedInsight = insightRows.find((row) => isInsightSelected(row));
    if (selectedInsight) {
      const element = eventElementMapRef.current.get(selectedInsight.event.id);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [
    insightRows,
    sections.milestones,
    sections.reasoning,
    selectedNodeId,
    selectionSource,
    visibleObservations,
  ]);

  const observationSummary = useMemo(
    () => `${visibleObservations.length} code reviews observed`,
    [visibleObservations.length],
  );
  const patternsSummary = useMemo(
    () => `${sections.milestones.length} patterns found`,
    [sections.milestones.length],
  );
  const insightsSummary = useMemo(
    () => `${sections.insights.length} insights determined`,
    [sections.insights.length],
  );
  const showPhaseProgress = sections.phase !== "observing" || sections.observations.length > 0;
  const shouldShowObservingSection = importStarted !== false;

  return (
    <LayoutGroup id="narrative-feed">
      <div className="h-full min-h-0 space-y-3 overflow-auto pr-1">
        {showPhaseProgress && shouldShowObservingSection ? (
          <PhaseProgressIndicator phase={sections.phase} complete={insightRows.length > 0} />
        ) : null}

        {shouldShowObservingSection ? (
          <CollapsiblePhaseSection
            isActive={sections.phase === "observing"}
            isComplete={sections.phase !== "observing"}
            summary={<span>{observationSummary}</span>}
            label="Code Reviews"
            className="space-y-2"
          >
            <SectionHeader icon={<Eye className="h-3.5 w-3.5" />} title="What I Observed" />
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {visibleObservations.length === 0 ? (
                  <ImportLoadingIndicator statusText={importStatusText} />
                ) : (
                  visibleObservations.map((event, index) => (
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
                      <ObservationRow
                        event={event}
                        index={index}
                        observationIndex={
                          typeof event.graphNodeId === "string"
                            ? observationIndexMap.get(event.graphNodeId)
                            : undefined
                        }
                        selected={activityEventMatchesNodeId(event, selectedNodeId)}
                        pinnedFromGraph={pinnedEventId === event.id}
                        onSelect={onSelectEvent}
                      />
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </CollapsiblePhaseSection>
        ) : null}

        <CollapsiblePhaseSection
          isActive={sections.phase === "analyzing"}
          isComplete={sections.phase === "connecting"}
          summary={<span>{patternsSummary}</span>}
          label="Patterns"
          className="space-y-2"
        >
          <SectionHeader icon={<Search className="h-3.5 w-3.5" />} title="Patterns Discovered" />

          <div className="space-y-2">
            {sections.reasoning ? (
              <motion.div
                key={sections.reasoning.id}
                layout
                layoutId={sections.reasoning.id}
                transition={CARD_LAYOUT_TRANSITION}
                ref={(element) => {
                  eventElementMapRef.current.set(sections.reasoning!.id, element);
                }}
                data-activity-event-id={sections.reasoning.id}
              >
                {renderEventCard({
                  event: sections.reasoning,
                  index: 0,
                  selectedNodeId,
                  onSelectEvent,
                })}
              </motion.div>
            ) : null}

            {sections.milestones.length === 0 ? (
              <p className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-400">
                Run Sleep Cycle to discover patterns...
              </p>
            ) : (
              sections.milestones.map((event, index) => (
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
                  <PatternRow
                    event={event}
                    observationIndexMap={observationIndexMap}
                    index={index}
                    selected={activityEventMatchesNodeId(event, selectedNodeId)}
                    onSelect={onSelectEvent}
                  />
                </motion.div>
              ))
            )}
          </div>
        </CollapsiblePhaseSection>

        <CollapsiblePhaseSection
          isActive={sections.phase === "connecting"}
          isComplete={insightRows.length > 0}
          summary={<span>{insightsSummary}</span>}
          label="Insights"
          className="space-y-2"
        >
          <SectionHeader icon={<Sparkles className="h-3.5 w-3.5" />} title="Why It Matters" />
          <div className="space-y-2">
            {insightRows.length === 0 ? (
              <p className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-400">
                Run Sleep Cycle to crystallize insights...
              </p>
            ) : (
              insightRows.map((row, index) => (
                <motion.div
                  key={row.event.id}
                  layout
                  layoutId={row.event.id}
                  transition={CARD_LAYOUT_TRANSITION}
                  ref={(element) => {
                    eventElementMapRef.current.set(row.event.id, element);
                  }}
                  data-activity-event-id={row.event.id}
                >
                  <ObservationRow
                    event={row.event}
                    index={index}
                    selected={isInsightSelected(row)}
                    onSelect={onSelectEvent}
                  />
                </motion.div>
              ))
            )}
          </div>
        </CollapsiblePhaseSection>
      </div>
    </LayoutGroup>
  );
}
