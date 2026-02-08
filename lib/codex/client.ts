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
type SupportedReasoningEffort = "minimal" | "low" | "medium" | "high";

function resolveModel(tier: CodexModelTier) {
  if (tier === "nano") {
    return NANO_MODEL;
  }

  if (tier === "consolidation") {
    return CONSOLIDATION_MODEL;
  }

  return DEFAULT_MODEL;
}

function resolveReasoningEffort(tier: CodexModelTier): SupportedReasoningEffort {
  if (tier === "consolidation") {
    return "high";
  }

  return "medium";
}

export function createCodexThread(tier: CodexModelTier = "mini") {
  const client = getCodexClient();

  return client.startThread({
    model: resolveModel(tier),
    // Override global Codex config values (for example `xhigh`) with model-supported values.
    modelReasoningEffort: resolveReasoningEffort(tier),
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

export interface StreamedRunCallbacks {
  onReasoningStart?: (id: string, text: string) => void;
  onReasoningDelta?: (id: string, text: string) => void;
  onReasoningComplete?: (id: string, text: string) => void;
  onResponseStart?: (id: string, text: string) => void;
  onResponseDelta?: (id: string, text: string) => void;
  onTurnComplete?: () => void;
}

export async function runStreamedWithSchema<T>(
  thread: Thread,
  prompt: string,
  schema: Record<string, unknown>,
  callbacks: StreamedRunCallbacks = {},
  signal?: AbortSignal,
): Promise<T> {
  const streamedTurn = await thread.runStreamed(prompt, {
    outputSchema: schema,
    signal,
  });

  let finalResponse = "";

  for await (const event of streamedTurn.events) {
    if (event.type === "item.started") {
      if (event.item.type === "reasoning") {
        callbacks.onReasoningStart?.(event.item.id, event.item.text);
      } else if (event.item.type === "agent_message") {
        callbacks.onResponseStart?.(event.item.id, event.item.text);
      }
      continue;
    }

    if (event.type === "item.updated") {
      if (event.item.type === "reasoning") {
        callbacks.onReasoningDelta?.(event.item.id, event.item.text);
      } else if (event.item.type === "agent_message") {
        callbacks.onResponseDelta?.(event.item.id, event.item.text);
      }
      continue;
    }

    if (event.type === "item.completed") {
      if (event.item.type === "reasoning") {
        callbacks.onReasoningComplete?.(event.item.id, event.item.text);
      } else if (event.item.type === "agent_message") {
        finalResponse = event.item.text;
      }
      continue;
    }

    if (event.type === "turn.completed") {
      callbacks.onTurnComplete?.();
      continue;
    }

    if (event.type === "turn.failed") {
      throw new Error(event.error.message);
    }

    if (event.type === "error") {
      throw new Error(event.message);
    }
  }

  const trimmedResponse = finalResponse.trim();

  if (!trimmedResponse) {
    throw new Error("Codex returned an empty response for a schema-constrained run");
  }

  try {
    return JSON.parse(trimmedResponse) as T;
  } catch {
    throw new Error(`Codex returned non-JSON schema response: ${trimmedResponse}`);
  }
}
