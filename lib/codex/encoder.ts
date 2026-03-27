import { readFile } from "node:fs/promises";
import path from "node:path";

import { createCodexThread, runWithSchema } from "@/lib/codex/client";
import { calibrateInitialSalience, clampSalienceScore } from "@/lib/codex/salience-policy";
import { mapToPatternKey, patternLabelForKey } from "@/lib/memory/pattern-taxonomy";
import type {
  EncodedEpisodeResult,
  EpisodeEncodingInput,
  EpisodeNarrativeFields,
} from "@/lib/codex/types";

const ENCODE_EPISODE_SCHEMA = {
  type: "object",
  properties: {
    what_happened: { type: "string" },
    the_pattern: { type: "string" },
    the_fix: { type: "string" },
    why_it_matters: { type: "string" },
    salience_score: { type: "integer", minimum: 0, maximum: 10 },
    triggers: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 12,
    },
  },
  required: [
    "what_happened",
    "the_pattern",
    "the_fix",
    "why_it_matters",
    "salience_score",
    "triggers",
  ],
  additionalProperties: false,
} as const;

function sanitizeTriggers(triggers: string[]) {
  const compact = triggers
    .map((trigger) => trigger.trim().toLowerCase())
    .filter((trigger) => trigger.length > 0);

  return Array.from(new Set(compact)).slice(0, 12);
}

function flattenReviews(input: EpisodeEncodingInput) {
  return input.reviews
    .map((review) => {
      const commentLines = review.comments
        .map((comment) => {
          const location = comment.line ? `${comment.path}:${comment.line}` : comment.path;
          return `- ${location} ${comment.body}`;
        })
        .join("\n");

      return [
        `Reviewer: ${review.authorLogin ?? "unknown"}`,
        `State: ${review.state}`,
        `Body: ${review.body || "(empty)"}`,
        commentLines,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export class EpisodeEncodingError extends Error {
  code = "ENCODING_MODEL_FAILURE";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EpisodeEncodingError";
  }
}

export async function encodeEpisode(input: EpisodeEncodingInput): Promise<EncodedEpisodeResult> {
  const promptTemplatePath = path.join(process.cwd(), ".codex/prompts/encode-episode.md");
  const promptTemplate = await readFile(promptTemplatePath, "utf8");

  const reviewText = flattenReviews(input);
  const snippetText = input.snippets.length > 0 ? input.snippets.join("\n\n") : "(no snippets extracted)";

  const prompt = [
    promptTemplate,
    "",
    "## Deterministic Fields",
    `repo: ${input.owner}/${input.repo}`,
    `pr_number: ${input.pr.number}`,
    `title: ${input.pr.title}`,
    `author: ${input.pr.authorLogin ?? "unknown"}`,
    `merged_at: ${input.pr.mergedAt ?? "unknown"}`,
    `source_url: ${input.pr.htmlUrl}`,
    "",
    "## Review Comments",
    reviewText || "(no review comments)",
    "",
    "## Code Snippets",
    snippetText,
  ].join("\n");

  let narrative: EpisodeNarrativeFields;
  try {
    const thread = createCodexThread("mini");
    narrative = await runWithSchema<EpisodeNarrativeFields>(thread, prompt, ENCODE_EPISODE_SCHEMA);
  } catch (error) {
    throw new EpisodeEncodingError("Failed to encode episode with Codex", { cause: error });
  }

  const patternKey = mapToPatternKey({
    title: input.pr.title,
    pattern: narrative.the_pattern,
    whatHappened: narrative.what_happened,
    fix: narrative.the_fix,
    triggers: narrative.triggers,
  });
  const canonicalPatternLabel = patternLabelForKey(patternKey);

  narrative = {
    ...narrative,
    the_pattern: canonicalPatternLabel,
    salience_score: clampSalienceScore(
      calibrateInitialSalience({
        rawScore: narrative.salience_score,
        patternKey,
      }),
    ),
    triggers: sanitizeTriggers(narrative.triggers),
  };

  return {
    episode: {
      source_pr_number: input.pr.number,
      title: input.pr.title,
      who: input.pr.authorLogin,
      what_happened: narrative.what_happened,
      pattern_key: patternKey,
      the_pattern: narrative.the_pattern,
      the_fix: narrative.the_fix,
      why_it_matters: narrative.why_it_matters,
      salience_score: narrative.salience_score,
      triggers: narrative.triggers,
      source_url: input.pr.htmlUrl,
      happened_at: input.pr.mergedAt,
    },
    narrative,
    reviewCount: input.reviews.length,
    snippetCount: input.snippets.length,
  };
}
