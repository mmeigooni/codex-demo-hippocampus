"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Eye, Lightbulb, Sparkles } from "lucide-react";

import { ActivityCard, type ActivityEventView } from "@/components/feed/ActivityCard";
import { CollapsiblePhaseSection } from "@/components/feed/CollapsiblePhaseSection";
import { ImportLoadingIndicator } from "@/components/feed/ImportLoadingIndicator";
import { ObservationRow } from "@/components/feed/ObservationRow";
import { PhaseProgressIndicator } from "@/components/feed/PhaseProgressIndicator";
import { PRGroupCard } from "@/components/feed/PRGroupCard";
import { RuleGroupCard } from "@/components/feed/RuleGroupCard";
import { ThinkingDivider } from "@/components/feed/ThinkingDivider";
import { getColorFamilyForPatternKey, getColorFamilyForRule } from "@/lib/color/cluster-palette";
import type { NarrativeSections } from "@/lib/feed/narrative-partition";
import { activityEventMatchesNodeId, buildFeedRenderWindow, type SelectionSource } from "@/lib/feed/cross-selection";
import { PATTERN_KEYS, type PatternKey } from "@/lib/memory/pattern-taxonomy";

interface NarrativeFeedProps {
  sections: NarrativeSections;
  maxItems?: number;
  importStatusText?: string | null;
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
  tier = "default",
  onSelectEvent,
}: {
  event: ActivityEventView;
  index: number;
  selectedNodeId: string | null;
  pinnedFromGraph?: boolean;
  tier?: "default" | "milestone";
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
        ruleTitle={typeof event.raw.title === "string" && event.raw.title.trim().length > 0 ? event.raw.title : event.title}
        ruleId={
          typeof event.raw.rule_id === "string" && event.raw.rule_id.trim().length > 0 ? event.raw.rule_id : event.graphNodeId
        }
        confidence={numberFromUnknown(event.raw.confidence) ?? undefined}
        triggers={event.triggers}
        episodeCount={numberFromUnknown(event.raw.episode_count) ?? undefined}
        index={index}
        selected={selected}
        pinnedFromGraph={pinnedFromGraph}
        graphNodeId={event.graphNodeId}
        rulePatternKey={typeof event.raw.rule_key === "string" && event.raw.rule_key.trim().length > 0 ? event.raw.rule_key : undefined}
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
      tier={tier}
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

export function NarrativeFeed({
  sections,
  maxItems = 12,
  importStatusText = null,
  selectedNodeId = null,
  selectionSource = null,
  onSelectEvent,
}: NarrativeFeedProps) {
  const eventElementMapRef = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const ruleHeaderMapRef = useRef<Map<string, HTMLDivElement | null>>(new Map());

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

    for (const group of sections.insights) {
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
  }, [sections.insights, sections.milestones, sections.reasoning, selectedNodeId, selectionSource, visibleObservations]);

  const showLearnedSection = sections.phase === "analyzing" || sections.phase === "connecting";
  const observationSummary = useMemo(
    () => `${visibleObservations.length} code reviews observed`,
    [visibleObservations.length],
  );
  const learnedSummary = useMemo(
    () => `${sections.insights.length} insights crystallized`,
    [sections.insights.length],
  );
  const showPhaseProgress = sections.phase !== "observing" || sections.observations.length > 0;

  const whyItMattersRows = useMemo(() => {
    return sections.insights
      .map((group) => {
        const summaries = Array.from(
          new Set(
            group.episodes
              .map((episode) => (typeof episode.whyItMatters === "string" ? episode.whyItMatters.trim() : ""))
              .filter((entry) => entry.length > 0),
          ),
        );

        if (summaries.length === 0) {
          return null;
        }

        return {
          id: group.ruleId,
          title: group.ruleTitle,
          summaries,
        };
      })
      .filter((entry): entry is { id: string; title: string; summaries: string[] } => entry !== null);
  }, [sections.insights]);

  const showWhySection = sections.phase === "connecting" && whyItMattersRows.length > 0;

  return (
    <LayoutGroup id="narrative-feed">
      <div className="max-h-[500px] space-y-3 overflow-auto pr-1">
        {showPhaseProgress ? <PhaseProgressIndicator phase={sections.phase} complete={showWhySection} /> : null}
        <CollapsiblePhaseSection
          isActive={sections.phase === "observing"}
          isComplete={sections.phase !== "observing"}
          summary={<span>{observationSummary}</span>}
          label="Observing"
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

        <AnimatePresence initial={false}>
          {sections.phase !== "observing" ? (
            <motion.div
              key="observations-thinking-divider"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <ThinkingDivider
                label="Analyzing patterns"
                active={sections.phase === "analyzing" && sections.insights.length === 0}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <CollapsiblePhaseSection
          isActive={showLearnedSection && sections.phase === "analyzing"}
          isComplete={sections.phase === "connecting"}
          summary={<span>{learnedSummary}</span>}
          className="space-y-2"
        >
          {sections.milestones.length > 0 ? (
            <div className="space-y-2">
              {sections.milestones.map((event, index) => (
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
                    tier: "milestone",
                    onSelectEvent,
                  })}
                </motion.div>
              ))}
            </div>
          ) : null}

          <SectionHeader icon={<Lightbulb className="h-3.5 w-3.5" />} title="What I Learned" />

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

            {sections.insights.length > 0 ? <ThinkingDivider label="Crystallizing insights" active={false} /> : null}

            {sections.insights.length === 0 ? (
              <p className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-400">
                Run Sleep Cycle to discover patterns...
              </p>
            ) : (
              sections.insights.map((group) => {
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
          </div>
        </CollapsiblePhaseSection>

        <CollapsiblePhaseSection
          isActive={showWhySection}
          isComplete={false}
          summary={<span />}
          className="space-y-2"
        >
          <SectionHeader icon={<Sparkles className="h-3.5 w-3.5" />} title="Why It Matters" />
          <div className="space-y-2">
            {whyItMattersRows.map((row) => (
              <article key={row.id} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-sm font-medium text-zinc-100">{row.title}</p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                  {row.summaries.map((summary) => (
                    <li key={`${row.id}-${summary}`}>• {summary}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </CollapsiblePhaseSection>
      </div>
    </LayoutGroup>
  );
}
