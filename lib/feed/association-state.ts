import type { ActivityEventView } from "@/components/feed/ActivityCard";

export type AssociationMap = Map<string, string>;

export interface AssociatedRuleGroup {
  ruleId: string;
  ruleTitle: string;
  rulePatternKey?: string;
  ruleEvent?: ActivityEventView;
  episodes: ActivityEventView[];
}

const ALWAYS_UNASSOCIATED_TYPES = new Set([
  "import_bootstrap",
  "pr_found",
  "encoding_start",
  "episode_skipped",
  "encoding_error",
  "complete",
  "consolidation_start",
  "pattern_detected",
  "salience_updated",
  "contradiction_found",
  "consolidation_complete",
  "consolidation_error",
  "reasoning",
  "distribution_progress",
  "distribution_complete",
  "distribution_error",
]);

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nonEmptyStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => nonEmptyString(entry))
    .filter((entry): entry is string => entry !== null);
}

function toRuleNodeId(ruleId: string): string {
  return `rule-${ruleId}`;
}

function toEpisodeNodeId(episodeId: string): string {
  return `episode-${episodeId}`;
}

function mappedRuleIdForEvent(event: ActivityEventView, associations: AssociationMap): string | null {
  if (typeof event.graphNodeId === "string" && event.graphNodeId.length > 0) {
    const mapped = associations.get(event.graphNodeId);
    if (mapped) {
      return mapped;
    }
  }

  if (Array.isArray(event.graphNodeIds)) {
    for (const nodeId of event.graphNodeIds) {
      if (typeof nodeId !== "string" || nodeId.length === 0) {
        continue;
      }

      const mapped = associations.get(nodeId);
      if (mapped) {
        return mapped;
      }
    }
  }

  return null;
}

function fallbackRuleTitle(ruleNodeId: string): string {
  const normalized = ruleNodeId.replace(/^rule-/, "");
  return `Rule ${normalized}`;
}

function ruleNodeIdFromRuleEvent(event: ActivityEventView): string | null {
  const graphNodeId = nonEmptyString(event.graphNodeId);
  if (graphNodeId) {
    return graphNodeId;
  }

  const rawRuleId = nonEmptyString(event.raw.rule_id);
  if (rawRuleId) {
    return toRuleNodeId(rawRuleId);
  }

  return null;
}

function ruleTitleFromRuleEvent(event: ActivityEventView): string {
  const rawTitle = nonEmptyString(event.raw.title);
  if (rawTitle) {
    return rawTitle;
  }

  const eventTitle = nonEmptyString(event.title);
  if (eventTitle) {
    return eventTitle;
  }

  return "Untitled rule";
}

function rulePatternKeyFromRuleEvent(event: ActivityEventView): string | undefined {
  return nonEmptyString(event.raw.rule_key) ?? undefined;
}

export function applyRulePromotedEvent(current: AssociationMap, eventData: Record<string, unknown>): AssociationMap {
  const ruleId = nonEmptyString(eventData.rule_id);
  const sourceEpisodeIds = nonEmptyStringArray(eventData.source_episode_ids);

  if (!ruleId || sourceEpisodeIds.length === 0) {
    return current;
  }

  const next = new Map(current);
  const mappedRuleNodeId = toRuleNodeId(ruleId);
  let changed = false;

  for (const episodeId of sourceEpisodeIds) {
    const episodeNodeId = toEpisodeNodeId(episodeId);
    if (next.get(episodeNodeId) === mappedRuleNodeId) {
      continue;
    }

    next.set(episodeNodeId, mappedRuleNodeId);
    changed = true;
  }

  return changed ? next : current;
}

export function partitionFeedEvents(events: ActivityEventView[], associations: AssociationMap): {
  unassociated: ActivityEventView[];
  associated: ActivityEventView[];
} {
  const unassociated: ActivityEventView[] = [];
  const associated: ActivityEventView[] = [];

  for (const event of events) {
    if (event.type === "rule_promoted") {
      associated.push(event);
      continue;
    }

    if (event.variant === "reasoning" || ALWAYS_UNASSOCIATED_TYPES.has(event.type)) {
      unassociated.push(event);
      continue;
    }

    if (mappedRuleIdForEvent(event, associations)) {
      associated.push(event);
      continue;
    }

    unassociated.push(event);
  }

  return { unassociated, associated };
}

export function groupAssociatedByRule(events: ActivityEventView[], associations: AssociationMap): AssociatedRuleGroup[] {
  const orderedRuleIds: string[] = [];
  const groupsByRuleId = new Map<string, AssociatedRuleGroup>();

  const ensureGroup = (ruleId: string) => {
    const existing = groupsByRuleId.get(ruleId);
    if (existing) {
      return existing;
    }

    const created: AssociatedRuleGroup = {
      ruleId,
      ruleTitle: fallbackRuleTitle(ruleId),
      episodes: [],
    };
    groupsByRuleId.set(ruleId, created);
    orderedRuleIds.push(ruleId);
    return created;
  };

  for (const event of events) {
    if (event.type === "rule_promoted") {
      const resolvedRuleNodeId = ruleNodeIdFromRuleEvent(event) ?? `rule-unknown-${event.id}`;
      const group = ensureGroup(resolvedRuleNodeId);
      group.ruleTitle = ruleTitleFromRuleEvent(event);
      group.rulePatternKey = rulePatternKeyFromRuleEvent(event) ?? group.rulePatternKey;
      group.ruleEvent = event;
      continue;
    }

    const mappedRuleNodeId = mappedRuleIdForEvent(event, associations);
    if (!mappedRuleNodeId) {
      continue;
    }

    const group = ensureGroup(mappedRuleNodeId);
    group.episodes.push(event);
  }

  return orderedRuleIds.map((ruleId) => groupsByRuleId.get(ruleId)!);
}
