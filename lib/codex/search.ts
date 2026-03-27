import { readFile } from "node:fs/promises";
import path from "node:path";

import { Lang, parse, pattern } from "@ast-grep/napi";

import { createCodexThread, runWithSchema } from "@/lib/codex/client";

export interface SearchRule {
  language: string;
  rule: string;
  intent: string;
}

export interface SearchRuleResult {
  triggers: string[];
  search_rules: SearchRule[];
}

export interface SearchSnippet {
  filePath: string;
  language: string;
  text: string;
  intent: string;
}

interface DiffFileBlock {
  filePath: string;
  content: string;
}

const SEARCH_RULE_SCHEMA = {
  type: "object",
  properties: {
    triggers: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 12,
    },
    search_rules: {
      type: "array",
      items: {
        type: "object",
        properties: {
          language: { type: "string" },
          rule: { type: "string" },
          intent: { type: "string" },
        },
        required: ["language", "rule", "intent"],
        additionalProperties: false,
      },
    },
  },
  required: ["triggers", "search_rules"],
  additionalProperties: false,
} as const;

function normalizeLanguage(language: string) {
  return language.trim().toLowerCase();
}

function languageForPath(filePath: string) {
  if (filePath.endsWith(".ts")) {
    return "typescript";
  }

  if (filePath.endsWith(".tsx")) {
    return "tsx";
  }

  if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
    return "javascript";
  }

  if (filePath.endsWith(".css")) {
    return "css";
  }

  return "unknown";
}

function astGrepLanguage(language: string) {
  const normalized = normalizeLanguage(language);

  if (normalized === "typescript") {
    return Lang.TypeScript;
  }

  if (normalized === "tsx") {
    return Lang.Tsx;
  }

  if (normalized === "javascript") {
    return Lang.JavaScript;
  }

  if (normalized === "css") {
    return Lang.Css;
  }

  return null;
}

function parseDiffBlocks(diff: string) {
  const lines = diff.split("\n");
  const files: DiffFileBlock[] = [];

  let activePath: string | null = null;
  let activeLines: string[] = [];

  const flushFile = () => {
    if (!activePath) {
      return;
    }

    files.push({
      filePath: activePath,
      content: activeLines.join("\n").trim(),
    });

    activePath = null;
    activeLines = [];
  };

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      flushFile();
      continue;
    }

    if (line.startsWith("+++ b/")) {
      activePath = line.replace("+++ b/", "").trim();
      continue;
    }

    if (!activePath) {
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      activeLines.push(line.slice(1));
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      activeLines.push(line.slice(1));
    }
  }

  flushFile();

  return files.filter((file) => file.content.length > 0);
}

function fallbackSearchRules(reviewComments: string[]) {
  const joined = reviewComments.join(" ").toLowerCase();
  const triggers = ["reviewed", "import"];

  if (joined.includes("retry")) triggers.push("retry");
  if (joined.includes("sql")) triggers.push("sql-injection");
  if (joined.includes("token")) triggers.push("token-handling");
  if (joined.includes("log")) triggers.push("logging");

  return {
    triggers,
    search_rules: [
      {
        language: "typescript",
        rule: "$FUNC($$$ARGS)",
        intent: "generic-function-call",
      },
    ],
  } satisfies SearchRuleResult;
}

export async function generateSearchRules(reviewComments: string[], prContext: string) {
  const promptPath = path.join(process.cwd(), ".codex/prompts/generate-triggers.md");
  const promptTemplate = await readFile(promptPath, "utf8");

  const fullPrompt = [
    promptTemplate,
    "",
    "## PR Context",
    prContext,
    "",
    "## Review Comments",
    ...reviewComments,
  ].join("\n");

  try {
    const thread = createCodexThread("nano");
    const response = await runWithSchema<SearchRuleResult>(thread, fullPrompt, SEARCH_RULE_SCHEMA);

    return {
      triggers: response.triggers,
      search_rules: response.search_rules,
    } satisfies SearchRuleResult;
  } catch {
    return fallbackSearchRules(reviewComments);
  }
}

export function executeSearch(diff: string, rules: SearchRule[]) {
  const files = parseDiffBlocks(diff);
  const snippets: SearchSnippet[] = [];

  for (const file of files) {
    const fileLanguage = languageForPath(file.filePath);
    const matchingRules = rules.filter(
      (rule) => normalizeLanguage(rule.language) === fileLanguage || normalizeLanguage(rule.language) === "any",
    );

    if (matchingRules.length === 0) {
      continue;
    }

    for (const rule of matchingRules) {
      const lang = astGrepLanguage(rule.language === "any" ? fileLanguage : rule.language);

      if (!lang) {
        snippets.push({
          filePath: file.filePath,
          language: fileLanguage,
          text: file.content,
          intent: `${rule.intent}:fallback-no-lang`,
        });
        continue;
      }

      try {
        const root = parse(lang, file.content);
        const matches = root.root().findAll(pattern(lang, rule.rule));

        if (matches.length > 0) {
          snippets.push({
            filePath: file.filePath,
            language: fileLanguage,
            text: matches.map((match) => match.text()).join("\n\n"),
            intent: rule.intent,
          });
        }
      } catch {
        snippets.push({
          filePath: file.filePath,
          language: fileLanguage,
          text: file.content,
          intent: `${rule.intent}:fallback-parse-error`,
        });
      }
    }
  }

  return snippets;
}

function estimateTokenCount(text: string) {
  return Math.ceil(text.length / 4);
}

export function summarizeTokenReduction(diff: string, snippets: SearchSnippet[]) {
  const rawTokens = estimateTokenCount(diff);
  const reducedText = snippets.map((snippet) => snippet.text).join("\n");
  const reducedTokens = estimateTokenCount(reducedText);

  return {
    rawTokens,
    reducedTokens,
    reductionRatio: rawTokens === 0 ? 0 : Number(((rawTokens - reducedTokens) / rawTokens).toFixed(2)),
  };
}
