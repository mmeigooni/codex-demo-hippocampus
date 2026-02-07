import { Codex, type Thread } from "@openai/codex-sdk";

const DEFAULT_MODEL = "gpt-5-mini";
const NANO_MODEL = "gpt-5-nano";
const CONSOLIDATION_MODEL = "gpt-5";

let codexClient: Codex | null = null;

function getCodexClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for Codex SDK calls");
  }

  if (!codexClient) {
    codexClient = new Codex({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return codexClient;
}

export type CodexModelTier = "nano" | "mini" | "consolidation";

function resolveModel(tier: CodexModelTier) {
  if (tier === "nano") {
    return NANO_MODEL;
  }

  if (tier === "consolidation") {
    return CONSOLIDATION_MODEL;
  }

  return DEFAULT_MODEL;
}

export function createCodexThread(tier: CodexModelTier = "mini") {
  const client = getCodexClient();

  return client.startThread({
    model: resolveModel(tier),
    workingDirectory: process.cwd(),
    skipGitRepoCheck: false,
    approvalPolicy: "never",
    sandboxMode: "read-only",
  });
}

export async function runWithSchema<T>(
  thread: Thread,
  prompt: string,
  schema: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const turn = await thread.run(prompt, {
    outputSchema: schema,
    signal,
  });

  const finalResponse = turn.finalResponse?.trim();

  if (!finalResponse) {
    throw new Error("Codex returned an empty response for a schema-constrained run");
  }

  try {
    return JSON.parse(finalResponse) as T;
  } catch {
    throw new Error(`Codex returned non-JSON schema response: ${finalResponse}`);
  }
}
