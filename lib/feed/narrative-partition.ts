import type { ActivityEventView } from "@/components/feed/ActivityCard";
import {
  groupAssociatedByRule,
  partitionFeedEvents,
  type AssociatedRuleGroup,
  type AssociationMap,
} from "@/lib/feed/association-state";
import { PATTERN_LABELS } from "@/lib/memory/pattern-taxonomy";

export type NarrativePhase = "observing" | "analyzing" | "connecting";

export interface NarrativeSections {
  observations: ActivityEventView[];
  insights: AssociatedRuleGroup[];
  milestones: ActivityEventView[];
  reasoning: ActivityEventView | null;
  phase: NarrativePhase;
}

const HIDDEN_EVENT_TYPES = new Set([
  "consolidation_start",
  "consolidation_complete",
  "consolidation_error",
  "encoding_start",
  "snippets_extracted",
  "episode_skipped",
  "encoding_error",
  "salience_updated",
  "distribution_progress",
  "distribution_complete",
  "distribution_error",
  "import_bootstrap",
  "pr_found",
  "complete",
]);

export const EVENT_TYPE_LABELS: Record<string, string> = {
  episode_created: "Observation",
  pr_group: "Code Review",
  pattern_detected: "Pattern Found",
  rule_promoted: "Insight",
  contradiction_found: "Tension",
  reasoning: "Analysis",
};

function fallbackPatternLabel(key: string): string {
  const normalized = key.trim().replace(/[_-]+/g, " ");
  if (normalized.length === 0) {
    return "Unknown pattern";
  }

  return normalized
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => token[0]!.toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

export function patternDisplayLabel(key: string | undefined | null): string {
  if (typeof key !== "string") {
    return "Unknown pattern";
  }

  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return "Unknown pattern";
  }

  return PATTERN_LABELS[trimmed as keyof typeof PATTERN_LABELS] ?? fallbackPatternLabel(trimmed);
}

function hasWhyItMatters(insights: AssociatedRuleGroup[]): boolean {
  return insights.some((group) =>
    group.episodes.some((episode) => typeof episode.whyItMatters === "string" && episode.whyItMatters.trim().length > 0),
  );
}

function derivePhase({ insights, milestones }: Pick<NarrativeSections, "insights" | "milestones">): NarrativePhase {
  if (insights.length === 0 && milestones.length === 0) {
    return "observing";
  }

  if (hasWhyItMatters(insights)) {
    return "connecting";
  }

  return "analyzing";
}

function isReasoningEvent(event: ActivityEventView): boolean {
  return event.variant === "reasoning" || event.type === "reasoning";
}

export function partitionIntoNarrative(events: ActivityEventView[], associations: AssociationMap): NarrativeSections {
  const visibleEvents = events.filter((event) => !HIDDEN_EVENT_TYPES.has(event.type));
  const { associated } = partitionFeedEvents(visibleEvents, associations);

  const observations = visibleEvents.filter((event) => event.type === "episode_created" || event.type === "pr_group");
  const milestones = visibleEvents.filter(
    (event) => event.type === "pattern_detected" || event.type === "contradiction_found",
  );

  let reasoning: ActivityEventView | null = null;
  for (let index = visibleEvents.length - 1; index >= 0; index -= 1) {
    const candidate = visibleEvents[index];
    if (candidate && isReasoningEvent(candidate)) {
      reasoning = candidate;
      break;
    }
  }

  const insights = groupAssociatedByRule(associated, associations);
  const phase = derivePhase({ insights, milestones });

  return {
    observations,
    insights,
    milestones,
    reasoning,
    phase,
  };
}
