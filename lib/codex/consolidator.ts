import { readFile } from "node:fs/promises";
import path from "node:path";

import { createCodexThread, runWithSchema } from "@/lib/codex/client";
import {
  buildRuleDescriptionForKey,
  buildRuleTitleForKey,
  mapToPatternKey,
  patternLabelForKey,
  type PatternKey,
} from "@/lib/memory/pattern-taxonomy";
import type {
  ConsolidationEpisodeInput,
  ConsolidationModelOutput,
  ConsolidationResult,
  ConsolidationRuleCandidate,
  ConsolidationRuleInput,
} from "@/lib/codex/types";

interface RawConsolidationRuleCandidate {
  title: string;
  description: string;
  triggers: string[];
  source_episode_ids: string[];
}

interface RawConsolidationModelOutput extends Omit<ConsolidationModelOutput, "rules_to_promote"> {
  rules_to_promote: RawConsolidationRuleCandidate[];
}

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

const configuredMinSupport = Number.parseInt(process.env.RULE_PROMOTION_MIN_SUPPORT ?? "2", 10);
const RULE_PROMOTION_MIN_SUPPORT =
  Number.isFinite(configuredMinSupport) && configuredMinSupport > 0 ? configuredMinSupport : 2;

function clampSalience(score: number) {
  return Math.max(0, Math.min(10, Math.round(score)));
}

function sanitizeTriggers(triggers: string[]) {
  const normalized = triggers
    .map((trigger) => trigger.trim().toLowerCase())
    .filter((trigger) => trigger.length > 0);

  return Array.from(new Set(normalized)).slice(0, 12);
}

function deriveRuleKey(
  rawRule: RawConsolidationRuleCandidate,
  sourceEpisodeIds: string[],
  episodeMap: Map<string, ConsolidationEpisodeInput>,
): PatternKey {
  const supportByKey = new Map<PatternKey, number>();

  for (const episodeId of sourceEpisodeIds) {
    const episode = episodeMap.get(episodeId);
    if (!episode) {
      continue;
    }

    supportByKey.set(episode.pattern_key, (supportByKey.get(episode.pattern_key) ?? 0) + 1);
  }

  if (supportByKey.size > 0) {
    const dominant = Array.from(supportByKey.entries()).sort((left, right) => {
      if (left[1] === right[1]) {
        return left[0].localeCompare(right[0]);
      }
      return right[1] - left[1];
    })[0];

    if (dominant) {
      return dominant[0];
    }
  }

  return mapToPatternKey({
    title: rawRule.title,
    pattern: rawRule.description,
    triggers: rawRule.triggers,
  });
}

export function sanitizeConsolidationOutput(
  raw: RawConsolidationModelOutput,
  episodes: ConsolidationEpisodeInput[],
): ConsolidationModelOutput {
  const episodeMap = new Map(episodes.map((episode) => [episode.id, episode]));
  const episodeIds = new Set(episodes.map((episode) => episode.id));

  const patternsByKey = new Map<PatternKey, string[]>();
  for (const episode of episodes) {
    const existing = patternsByKey.get(episode.pattern_key) ?? [];
    existing.push(episode.id);
    patternsByKey.set(episode.pattern_key, existing);
  }

  const patterns = Array.from(patternsByKey.entries())
    .sort((left, right) => {
      if (left[1].length === right[1].length) {
        return left[0].localeCompare(right[0]);
      }
      return right[1].length - left[1].length;
    })
    .map(([patternKey, ids]) => ({
      name: patternLabelForKey(patternKey),
      episode_ids: ids,
      summary: `Recurring pattern in ${ids.length} episode(s): ${patternLabelForKey(patternKey)}`,
    }));

  const mappedModelRules = new Map<PatternKey, ConsolidationRuleCandidate>();
  for (const rawRule of raw.rules_to_promote) {
    const sourceEpisodeIds = Array.from(
      new Set(rawRule.source_episode_ids.filter((episodeId) => episodeIds.has(episodeId))),
    );

    if (sourceEpisodeIds.length === 0) {
      continue;
    }

    const ruleKey = deriveRuleKey(rawRule, sourceEpisodeIds, episodeMap);
    const existing = mappedModelRules.get(ruleKey);

    if (!existing) {
      mappedModelRules.set(ruleKey, {
        rule_key: ruleKey,
        title: buildRuleTitleForKey(ruleKey),
        description: buildRuleDescriptionForKey(ruleKey),
        triggers: sanitizeTriggers(rawRule.triggers),
        source_episode_ids: sourceEpisodeIds,
      });
      continue;
    }

    existing.triggers = sanitizeTriggers([...existing.triggers, ...rawRule.triggers]);
    existing.source_episode_ids = Array.from(new Set([...existing.source_episode_ids, ...sourceEpisodeIds]));
  }

  const rules = new Map<PatternKey, ConsolidationRuleCandidate>();

  for (const [patternKey, ids] of patternsByKey.entries()) {
    if (ids.length < RULE_PROMOTION_MIN_SUPPORT) {
      continue;
    }

    const modelRule = mappedModelRules.get(patternKey);
    const deterministicTriggers = sanitizeTriggers(
      ids.flatMap((episodeId) => episodeMap.get(episodeId)?.triggers ?? []),
    );

    const mergedTriggers = sanitizeTriggers([...(modelRule?.triggers ?? []), ...deterministicTriggers]);
    const ruleTriggers = mergedTriggers.length > 0 ? mergedTriggers : [patternKey];

    rules.set(patternKey, {
      rule_key: patternKey,
      title: buildRuleTitleForKey(patternKey),
      description: buildRuleDescriptionForKey(patternKey),
      triggers: ruleTriggers,
      source_episode_ids: ids,
    });
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
      used_fallback: false,
    };
  }

  const promptTemplatePath = path.join(process.cwd(), ".codex/prompts/consolidate.md");
  const promptTemplate = await readFile(promptTemplatePath, "utf8");

  const thread = createCodexThread("consolidation");
  const prompt = buildPrompt(input, promptTemplate);
  const output = await runWithSchema<RawConsolidationModelOutput>(thread, prompt, CONSOLIDATION_SCHEMA, input.signal);

  const sanitized = sanitizeConsolidationOutput(output, input.episodes);

  return {
    ...sanitized,
    used_fallback: false,
  };
}
