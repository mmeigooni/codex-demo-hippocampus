import { readFile } from "node:fs/promises";
import path from "node:path";

import { createCodexThread, runWithSchema } from "@/lib/codex/client";
import type {
  ConsolidationEpisodeInput,
  ConsolidationModelOutput,
  ConsolidationResult,
  ConsolidationRuleCandidate,
  ConsolidationRuleInput,
} from "@/lib/codex/types";

const CONSOLIDATION_SCHEMA = {
  type: "object",
  properties: {
    patterns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          episode_ids: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
        },
        required: ["name", "episode_ids", "summary"],
        additionalProperties: false,
      },
    },
    rules_to_promote: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          triggers: { type: "array", items: { type: "string" } },
          source_episode_ids: { type: "array", items: { type: "string" } },
        },
        required: ["title", "description", "triggers", "source_episode_ids"],
        additionalProperties: false,
      },
    },
    contradictions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          left_episode_id: { type: "string" },
          right_episode_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["left_episode_id", "right_episode_id", "reason"],
        additionalProperties: false,
      },
    },
    salience_updates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          episode_id: { type: "string" },
          salience_score: { type: "integer", minimum: 0, maximum: 10 },
          reason: { type: "string" },
        },
        required: ["episode_id", "salience_score", "reason"],
        additionalProperties: false,
      },
    },
    prune_candidates: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["patterns", "rules_to_promote", "contradictions", "salience_updates", "prune_candidates"],
  additionalProperties: false,
} as const;

interface ConsolidateEpisodesInput {
  repoFullName: string;
  episodes: ConsolidationEpisodeInput[];
  existingRules: ConsolidationRuleInput[];
  signal?: AbortSignal;
}

function clampSalience(score: number) {
  return Math.max(0, Math.min(10, Math.round(score)));
}

function sanitizeTriggers(triggers: string[]) {
  const normalized = triggers
    .map((trigger) => trigger.trim().toLowerCase())
    .filter((trigger) => trigger.length > 0);

  return Array.from(new Set(normalized)).slice(0, 12);
}

export function sanitizeConsolidationOutput(
  raw: ConsolidationModelOutput,
  episodes: ConsolidationEpisodeInput[],
): ConsolidationModelOutput {
  const episodeIds = new Set(episodes.map((episode) => episode.id));

  const patterns = raw.patterns
    .map((pattern) => ({
      ...pattern,
      name: pattern.name.trim(),
      summary: pattern.summary.trim(),
      episode_ids: pattern.episode_ids.filter((episodeId) => episodeIds.has(episodeId)),
    }))
    .filter((pattern) => pattern.name.length > 0 && pattern.summary.length > 0 && pattern.episode_ids.length > 0);

  const rules = new Map<string, ConsolidationRuleCandidate>();
  for (const rule of raw.rules_to_promote) {
    const title = rule.title.trim();
    const description = rule.description.trim();
    const sourceEpisodeIds = Array.from(
      new Set(rule.source_episode_ids.filter((episodeId) => episodeIds.has(episodeId))),
    );
    const triggers = sanitizeTriggers(rule.triggers);

    if (title.length === 0 || description.length === 0 || sourceEpisodeIds.length === 0 || triggers.length === 0) {
      continue;
    }

    const dedupeKey = title.toLowerCase();
    if (!rules.has(dedupeKey)) {
      rules.set(dedupeKey, {
        title,
        description,
        triggers,
        source_episode_ids: sourceEpisodeIds,
      });
    }
  }

  const contradictionKeys = new Set<string>();
  const contradictions = raw.contradictions
    .filter((contradiction) => {
      if (!episodeIds.has(contradiction.left_episode_id) || !episodeIds.has(contradiction.right_episode_id)) {
        return false;
      }

      if (contradiction.left_episode_id === contradiction.right_episode_id) {
        return false;
      }

      const key = [contradiction.left_episode_id, contradiction.right_episode_id].sort().join("::");
      if (contradictionKeys.has(key)) {
        return false;
      }

      contradictionKeys.add(key);
      return contradiction.reason.trim().length > 0;
    })
    .map((contradiction) => ({
      ...contradiction,
      reason: contradiction.reason.trim(),
    }));

  const salienceUpdates = new Map<string, { episode_id: string; salience_score: number; reason: string }>();
  for (const update of raw.salience_updates) {
    if (!episodeIds.has(update.episode_id)) {
      continue;
    }

    const reason = update.reason.trim();
    if (!reason) {
      continue;
    }

    salienceUpdates.set(update.episode_id, {
      episode_id: update.episode_id,
      salience_score: clampSalience(update.salience_score),
      reason,
    });
  }

  const pruneCandidates = Array.from(new Set(raw.prune_candidates.filter((episodeId) => episodeIds.has(episodeId))));

  return {
    patterns,
    rules_to_promote: Array.from(rules.values()),
    contradictions,
    salience_updates: Array.from(salienceUpdates.values()),
    prune_candidates: pruneCandidates,
  };
}

function buildFallbackConsolidation(episodes: ConsolidationEpisodeInput[]): ConsolidationModelOutput {
  const groupedByPattern = new Map<string, ConsolidationEpisodeInput[]>();

  for (const episode of episodes) {
    const key = (episode.the_pattern ?? "general-review-pattern").trim().toLowerCase();
    const bucket = groupedByPattern.get(key) ?? [];
    bucket.push(episode);
    groupedByPattern.set(key, bucket);
  }

  const orderedPatterns = Array.from(groupedByPattern.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);

  const patterns = orderedPatterns.map(([patternName, patternEpisodes]) => ({
    name: patternName,
    episode_ids: patternEpisodes.map((episode) => episode.id),
    summary: `Recurring pattern in ${patternEpisodes.length} episode(s): ${patternName}`,
  }));

  const rulesToPromote = orderedPatterns
    .filter(([, patternEpisodes]) => patternEpisodes.length >= 2)
    .map(([patternName, patternEpisodes]) => ({
      title: `Guard against ${patternName}`,
      description: `Codify a reusable checklist to prevent ${patternName} regressions.`,
      triggers: sanitizeTriggers(patternEpisodes.flatMap((episode) => episode.triggers)).slice(0, 6),
      source_episode_ids: patternEpisodes.map((episode) => episode.id),
    }))
    .filter((rule) => rule.triggers.length > 0);

  return {
    patterns,
    rules_to_promote: rulesToPromote,
    contradictions: [],
    salience_updates: [],
    prune_candidates: [],
  };
}

function buildPrompt(input: ConsolidateEpisodesInput, promptTemplate: string) {
  return [
    promptTemplate,
    "",
    "## Repository",
    input.repoFullName,
    "",
    "## Episodes",
    JSON.stringify(input.episodes, null, 2),
    "",
    "## Existing Rules",
    JSON.stringify(input.existingRules, null, 2),
  ].join("\n");
}

export async function consolidateEpisodes(input: ConsolidateEpisodesInput): Promise<ConsolidationResult> {
  if (input.episodes.length === 0) {
    return {
      patterns: [],
      rules_to_promote: [],
      contradictions: [],
      salience_updates: [],
      prune_candidates: [],
      used_fallback: true,
    };
  }

  const promptTemplatePath = path.join(process.cwd(), ".codex/prompts/consolidate.md");
  const promptTemplate = await readFile(promptTemplatePath, "utf8");

  let output: ConsolidationModelOutput;
  let usedFallback = false;

  try {
    const thread = createCodexThread("consolidation");
    const prompt = buildPrompt(input, promptTemplate);
    output = await runWithSchema<ConsolidationModelOutput>(thread, prompt, CONSOLIDATION_SCHEMA, input.signal);
  } catch {
    output = buildFallbackConsolidation(input.episodes);
    usedFallback = true;
  }

  const sanitized = sanitizeConsolidationOutput(output, input.episodes);

  return {
    ...sanitized,
    used_fallback: usedFallback,
  };
}
