import type { BrainEdgeModel, BrainNodeModel } from "@/components/brain/types";
import type { ActivityEventView } from "@/components/feed/ActivityCard";
import { activityEventMatchesNodeId } from "@/lib/feed/cross-selection";
import { toImportActivityEvent } from "@/lib/feed/import-activity";
import { patternDisplayLabel } from "@/lib/feed/narrative-partition";
import type { ConsolidationEvent } from "@/lib/codex/types";
import type { ImportEvent } from "@/lib/github/types";
import { parseJsonSseBuffer } from "@/lib/sse/parse";

export type StorageMode = "supabase" | "memory-fallback";

export type OnboardingPhase =
  | "idle"
  | "importing"
  | "ready"
  | "consolidating"
  | "consolidated"
  | "distributing"
  | "distributed"
  | "error";

export interface GraphPayload {
  nodes: BrainNodeModel[];
  edges: BrainEdgeModel[];
  stats: {
    episodeCount: number;
    ruleCount: number;
  };
}

export const EMPTY_GRAPH: GraphPayload = {
  nodes: [],
  edges: [],
  stats: {
    episodeCount: 0,
    ruleCount: 0,
  },
};

export const PHASE_ORDER: Record<OnboardingPhase, number> = {
  idle: 0,
  importing: 1,
  ready: 2,
  consolidating: 3,
  consolidated: 4,
  distributing: 5,
  distributed: 6,
  error: 7,
};

export function moveForwardPhase(current: OnboardingPhase, next: OnboardingPhase) {
  return PHASE_ORDER[next] >= PHASE_ORDER[current] ? next : current;
}

export function nonEmptyText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function numberFromUnknown(value: unknown) {
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

export function toObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value));
}

export function toNullableObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(Object.entries(value));
}

function resolvePatternFromRaw(raw: Record<string, unknown>) {
  const nestedEpisode = raw.episode;
  if (nestedEpisode && typeof nestedEpisode === "object") {
    const nestedPattern = nonEmptyText(toObject(nestedEpisode).the_pattern);
    if (nestedPattern) {
      return nestedPattern;
    }
  }

  const topLevelPattern = nonEmptyText(raw.the_pattern);
  if (topLevelPattern) {
    return topLevelPattern;
  }

  return null;
}

function hasNarrativeContent(narrative: SelectedNarrative) {
  return (
    nonEmptyText(narrative.whatHappened) !== null ||
    nonEmptyText(narrative.thePattern) !== null ||
    nonEmptyText(narrative.theFix) !== null ||
    nonEmptyText(narrative.whyItMatters) !== null ||
    (typeof narrative.ruleConfidence === "number" && Number.isFinite(narrative.ruleConfidence)) ||
    (typeof narrative.ruleEpisodeCount === "number" && Number.isFinite(narrative.ruleEpisodeCount))
  );
}

function latestMatchingEpisodeEvent(activityEvents: ActivityEventView[], selectedNodeId: string) {
  for (let index = activityEvents.length - 1; index >= 0; index -= 1) {
    const event = activityEvents[index];
    if (!event) {
      continue;
    }

    if (event.type === "episode_created" && activityEventMatchesNodeId(event, selectedNodeId)) {
      return event;
    }

    if (Array.isArray(event.groupedEpisodes) && event.groupedEpisodes.length > 0) {
      for (let nestedIndex = event.groupedEpisodes.length - 1; nestedIndex >= 0; nestedIndex -= 1) {
        const nestedEvent = event.groupedEpisodes[nestedIndex];
        if (!nestedEvent || nestedEvent.type !== "episode_created") {
          continue;
        }

        if (activityEventMatchesNodeId(nestedEvent, selectedNodeId)) {
          return nestedEvent;
        }
      }
    }
  }

  return null;
}

function latestMatchingRuleEvent(activityEvents: ActivityEventView[], selectedNodeId: string) {
  for (let index = activityEvents.length - 1; index >= 0; index -= 1) {
    const event = activityEvents[index];
    if (!event || event.type !== "rule_promoted") {
      continue;
    }

    if (activityEventMatchesNodeId(event, selectedNodeId)) {
      return event;
    }
  }

  return null;
}

function resolveRuleEpisodeCount(ruleEvent: ActivityEventView | null) {
  if (!ruleEvent) {
    return null;
  }

  const explicitCount = numberFromUnknown(ruleEvent.raw.episode_count);
  if (explicitCount !== null) {
    return explicitCount;
  }

  const sourceEpisodeIds = ruleEvent.raw.source_episode_ids;
  if (Array.isArray(sourceEpisodeIds)) {
    return sourceEpisodeIds.filter((id) => typeof id === "string" && id.length > 0).length;
  }

  return null;
}

export interface SelectedNarrative {
  whatHappened?: string;
  thePattern?: string;
  theFix?: string;
  whyItMatters?: string;
  ruleConfidence?: number;
  ruleEpisodeCount?: number;
}

interface ResolveSelectedNarrativeInput {
  activityEvents: ActivityEventView[];
  selectedNodeId: string | null;
  selectedNodeType: BrainNodeModel["type"] | null;
  selectedPatternKey: string | null;
}

export function resolveSelectedNarrative({
  activityEvents,
  selectedNodeId,
  selectedNodeType,
  selectedPatternKey,
}: ResolveSelectedNarrativeInput): SelectedNarrative | null {
  if (!selectedNodeId || !selectedNodeType) {
    return null;
  }

  const isRuleNode = selectedNodeType === "rule" || selectedNodeId.startsWith("rule-");
  if (isRuleNode) {
    const matchingRuleEvent = latestMatchingRuleEvent(activityEvents, selectedNodeId);
    const patternFromNode = nonEmptyText(selectedPatternKey);
    const patternFromRuleEvent = nonEmptyText(matchingRuleEvent?.raw.rule_key);
    const resolvedPatternKey = patternFromNode ?? patternFromRuleEvent;
    const patternLabel = resolvedPatternKey ? patternDisplayLabel(resolvedPatternKey) : undefined;

    const ruleConfidence = numberFromUnknown(matchingRuleEvent?.raw.confidence) ?? undefined;
    const ruleEpisodeCount = resolveRuleEpisodeCount(matchingRuleEvent) ?? undefined;
    const whyItMatters = nonEmptyText(matchingRuleEvent?.raw.description) ?? undefined;
    const whatHappened =
      typeof ruleEpisodeCount === "number"
        ? `${ruleEpisodeCount} observation${ruleEpisodeCount === 1 ? "" : "s"} converged into this rule.`
        : undefined;

    const narrative: SelectedNarrative = {
      whatHappened,
      thePattern: patternLabel,
      whyItMatters,
      ruleConfidence,
      ruleEpisodeCount,
    };

    return hasNarrativeContent(narrative) ? narrative : null;
  }

  const episodeEvent = latestMatchingEpisodeEvent(activityEvents, selectedNodeId);
  if (!episodeEvent) {
    return null;
  }

  const subtitlePattern = nonEmptyText(episodeEvent.subtitle);
  const rawPattern = resolvePatternFromRaw(episodeEvent.raw);
  const resolvedPattern = subtitlePattern ?? (rawPattern ? patternDisplayLabel(rawPattern) : undefined);

  const narrative: SelectedNarrative = {
    whatHappened: nonEmptyText(episodeEvent.whatHappened) ?? undefined,
    thePattern: resolvedPattern,
    theFix: nonEmptyText(episodeEvent.theFix) ?? undefined,
    whyItMatters: nonEmptyText(episodeEvent.whyItMatters) ?? undefined,
  };

  return hasNarrativeContent(narrative) ? narrative : null;
}

export function parseImportEventsFromBuffer(rawBuffer: string) {
  const parsed = parseJsonSseBuffer(rawBuffer);
  const events = parsed.events.map((event) => ({ type: event.type, data: toObject(event.data) }) as ImportEvent);
  return { events, remainder: parsed.remainder };
}

export function consolidationEventToActivity(event: ConsolidationEvent, index: number): ActivityEventView | null {
  const prefix = `consolidation-${event.type}-${index}`;
  const data = toObject(event.data);

  if (
    event.type === "replay_manifest" ||
    event.type === "reasoning_start" ||
    event.type === "reasoning_delta" ||
    event.type === "reasoning_complete" ||
    event.type === "response_start" ||
    event.type === "response_delta"
  ) {
    return null;
  }

  if (event.type === "consolidation_start") {
    return {
      id: prefix,
      type: event.type,
      title: `Analyzing ${String(data.repo_full_name ?? "repository")}...`,
      subtitle: `${String(data.episode_count ?? 0)} episodes, ${String(data.existing_rule_count ?? 0)} existing rules`,
      variant: "consolidation",
      raw: data,
    };
  }

  if (event.type === "pattern_detected") {
    return {
      id: prefix,
      type: event.type,
      title: `Pattern detected: ${patternDisplayLabel(String(data.pattern_key ?? "review-hygiene"))}`,
      subtitle: `${String((Array.isArray(data.episode_ids) ? data.episode_ids.length : 0) ?? 0)} related episodes`,
      variant: "consolidation",
      raw: data,
    };
  }

  if (event.type === "rule_promoted") {
    const ruleId = nonEmptyText(data.rule_id);
    const graphNodeId = ruleId ? `rule-${ruleId}` : undefined;
    const sourceEpisodeIds = Array.isArray(data.source_episode_ids)
      ? data.source_episode_ids.filter((id): id is string => typeof id === "string")
      : [];

    return {
      id: prefix,
      type: event.type,
      title: `Rule promoted: ${String(data.title ?? "Untitled rule")}`,
      subtitle: `${patternDisplayLabel(String(data.rule_key ?? "review-hygiene"))} · ${sourceEpisodeIds.length} source episode${sourceEpisodeIds.length === 1 ? "" : "s"}`,
      variant: "consolidation",
      graphNodeId,
      raw: data,
    };
  }

  if (event.type === "contradiction_found") {
    return {
      id: prefix,
      type: event.type,
      title: "Contradiction found",
      subtitle: `${String(data.left_episode_title ?? "Episode A")} ↔ ${String(data.right_episode_title ?? "Episode B")}`,
      variant: "consolidation",
      raw: data,
    };
  }

  if (event.type === "salience_updated") {
    return {
      id: prefix,
      type: event.type,
      title: `Salience updated: ${String(data.episode_title ?? "Episode")}`,
      subtitle: `Score: ${String(data.salience_score ?? 0)}`,
      variant: "consolidation",
      graphNodeId: typeof data.episode_id === "string" ? `episode-${data.episode_id}` : undefined,
      raw: data,
    };
  }

  if (event.type === "consolidation_complete") {
    const summary = toNullableObject(data.summary);
    const counts = toObject(summary?.counts);
    return {
      id: prefix,
      type: event.type,
      title: "Consolidation complete",
      subtitle: `${String(counts.patterns ?? 0)} patterns · ${String(counts.rules_promoted ?? 0)} rules · ${String(counts.salience_updates ?? 0)} salience updates`,
      variant: "consolidation",
      raw: data,
    };
  }

  if (event.type === "consolidation_error") {
    return {
      id: prefix,
      type: event.type,
      title: "Consolidation failed",
      subtitle: String(data.message ?? "Unknown error"),
      variant: "consolidation",
      raw: data,
    };
  }

  return null;
}

interface DistributionResultLike {
  prUrl?: string;
  prNumber?: number;
  branch?: string;
  skippedPr: boolean;
  reason?: string;
  markdown?: string;
  error?: string;
}

export function buildActivityEvents({
  importEvents,
  consolidationEvents,
  reasoningText,
  isReasoningActive,
  distributionPhase,
  isDistributing,
  distributionResult,
  phase,
  activeRepo,
}: {
  importEvents: ImportEvent[];
  consolidationEvents: ConsolidationEvent[];
  reasoningText: string;
  isReasoningActive: boolean;
  distributionPhase: string | null;
  isDistributing: boolean;
  distributionResult: DistributionResultLike | null;
  phase: OnboardingPhase;
  activeRepo: string | null;
}) {
  const importActivityEvents = importEvents
    .map((event, index) => toImportActivityEvent(event, index))
    .filter((event): event is ActivityEventView => event !== null);
  const consolidationActivityEvents = consolidationEvents
    .map((event, index) => consolidationEventToActivity(event, index))
    .filter((event): event is ActivityEventView => event !== null);

  const mergedEvents = [...importActivityEvents, ...consolidationActivityEvents];

  if (isReasoningActive || reasoningText) {
    mergedEvents.push({
      id: "reasoning-live",
      type: "reasoning",
      title: "Model reasoning",
      variant: "reasoning",
      reasoningText,
      isStreamingReasoning: isReasoningActive,
      raw: { text: reasoningText },
    });
  }

  if (distributionPhase && isDistributing) {
    mergedEvents.push({
      id: `distribution-phase-${distributionPhase}`,
      type: "distribution_progress",
      title: distributionPhase,
      variant: "distribution",
      raw: { phase: distributionPhase },
    });
  }

  if (distributionResult) {
    mergedEvents.push({
      id: `distribution-result-${distributionResult.prNumber ?? distributionResult.reason ?? "complete"}`,
      type: distributionResult.error ? "distribution_error" : "distribution_complete",
      title: distributionResult.error
        ? "Distribution failed"
        : distributionResult.skippedPr
          ? "Distribution preview generated"
          : "Distribution complete",
      subtitle: distributionResult.error
        ? distributionResult.error
        : distributionResult.prUrl
          ? `PR #${distributionResult.prNumber ?? "?"} is ready`
          : distributionResult.reason,
      variant: "distribution",
      raw: toObject(distributionResult),
    });
  }

  if (phase === "importing" && mergedEvents.length === 0 && activeRepo) {
    return [
      {
        id: `bootstrap-${activeRepo}`,
        type: "import_bootstrap",
        title: `Preparing ${activeRepo}`,
        subtitle: "Verifying repository access and loading merged pull requests...",
        variant: "import",
        raw: { repo: activeRepo },
      } satisfies ActivityEventView,
    ];
  }

  return mergedEvents;
}

export function latestImportStatusText(importEvents: ImportEvent[], phase: OnboardingPhase) {
  if (phase !== "importing") {
    return null;
  }

  const latestEvent = importEvents[importEvents.length - 1];
  if (!latestEvent) {
    return null;
  }

  const data = toObject(latestEvent.data);

  if (latestEvent.type === "encoding_start") {
    const title = typeof data.title === "string" && data.title.trim().length > 0 ? data.title.trim() : "Untitled PR";
    const truncatedTitle = title.length > 60 ? `${title.slice(0, 57)}...` : title;
    return `Scanning PR #${String(data.pr_number ?? "?")}: ${truncatedTitle}`;
  }

  if (String(latestEvent.type) === "snippets_extracted") {
    return `Extracted ${String(data.snippet_count ?? "?")} snippets from ${String(data.file_count ?? "?")} files`;
  }

  if (latestEvent.type === "episode_created") {
    const episode = toNullableObject(data.episode);
    const pattern = typeof episode?.the_pattern === "string" ? episode.the_pattern : null;
    const title = typeof episode?.title === "string" && episode.title.trim().length > 0 ? episode.title.trim() : "observation";
    return pattern ? `Encoded pattern: ${pattern}` : `Encoded: ${title}`;
  }

  return null;
}

export function deriveStatusText({
  phase,
  importEvents,
  error,
  consolidationError,
  distributionResult,
}: {
  phase: OnboardingPhase;
  importEvents: ImportEvent[];
  error: string | null;
  consolidationError: string | null;
  distributionResult: DistributionResultLike | null;
}) {
  const activeError = error ?? consolidationError ?? distributionResult?.error ?? null;

  if (phase === "importing") {
    if (importEvents.length === 0) {
      return "Preparing import. Verifying repository access and scanning merged pull requests.";
    }

    return "Reading code reviews...";
  }

  if (phase === "ready") {
    const completeEvent = importEvents.findLast((event) => event.type === "complete");
    const completeData = completeEvent ? toObject(completeEvent.data) : {};
    const total = Number(completeData.total ?? 0);
    const failed = Number(completeData.failed ?? 0);
    const skipped = Number(completeData.skipped ?? 0);

    if (total === 0 && skipped > 0 && failed === 0) {
      return `Finished reading. ${skipped} observations already captured.`;
    }

    if (failed > 0 && skipped > 0) {
      return `Finished reading. ${total} observations captured (${skipped} already imported, ${failed} failed).`;
    }

    if (failed > 0) {
      return `Finished reading. ${total} observations captured (${failed} failed).`;
    }

    if (skipped > 0) {
      return `Finished reading. ${total} observations captured (${skipped} already imported).`;
    }

    return `Finished reading. ${total} observations captured.`;
  }

  if (phase === "consolidating") {
    return "Analyzing patterns across observations...";
  }

  if (phase === "consolidated") {
    return "Analysis complete. Insights ready.";
  }

  if (phase === "distributing") {
    return "Distributing to repo...";
  }

  if (phase === "distributed") {
    if (distributionResult?.error) {
      return distributionResult.error;
    }

    if (distributionResult?.prUrl) {
      return `Distribution complete. PR #${distributionResult.prNumber ?? "?"} created.`;
    }

    if (distributionResult?.skippedPr) {
      return "Distribution preview generated. Open a PR manually.";
    }

    return "Distribution complete.";
  }

  if (phase === "error") {
    return activeError ?? "Workflow encountered an error.";
  }

  return "Select a repository to begin.";
}
