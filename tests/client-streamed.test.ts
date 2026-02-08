import { describe, expect, it, vi } from "vitest";
import type { Thread, ThreadEvent } from "@openai/codex-sdk";

import { runStreamedWithSchema } from "@/lib/codex/client";

function buildEventsStream(events: ThreadEvent[]): AsyncGenerator<ThreadEvent> {
  return (async function* stream() {
    for (const event of events) {
      yield event;
    }
  })();
}

describe("runStreamedWithSchema", () => {
  it("streams reasoning/response callbacks in order and returns parsed JSON", async () => {
    const events: ThreadEvent[] = [
      { type: "item.started", item: { id: "r-1", type: "reasoning", text: "" } },
      { type: "item.updated", item: { id: "r-1", type: "reasoning", text: "Thinking..." } },
      {
        type: "item.completed",
        item: { id: "r-1", type: "reasoning", text: "Thinking... done." },
      },
      { type: "item.started", item: { id: "a-1", type: "agent_message", text: "" } },
      { type: "item.updated", item: { id: "a-1", type: "agent_message", text: '{"answer":' } },
      { type: "item.completed", item: { id: "a-1", type: "agent_message", text: '{"answer":42}' } },
      {
        type: "turn.completed",
        usage: {
          input_tokens: 10,
          cached_input_tokens: 0,
          output_tokens: 5,
        },
      },
    ];

    const runStreamed = vi.fn().mockResolvedValue({
      events: buildEventsStream(events),
    });

    const callbackOrder: string[] = [];
    const thread = {
      runStreamed,
    } as unknown as Thread;

    const result = await runStreamedWithSchema<{ answer: number }>(thread, "prompt", { type: "object" }, {
      onReasoningStart: (id, text) => callbackOrder.push(`reasoning_start:${id}:${text}`),
      onReasoningDelta: (id, text) => callbackOrder.push(`reasoning_delta:${id}:${text}`),
      onReasoningComplete: (id, text) => callbackOrder.push(`reasoning_complete:${id}:${text}`),
      onResponseStart: (id, text) => callbackOrder.push(`response_start:${id}:${text}`),
      onResponseDelta: (id, text) => callbackOrder.push(`response_delta:${id}:${text}`),
      onTurnComplete: () => callbackOrder.push("turn_complete"),
    });

    expect(result).toEqual({ answer: 42 });
    expect(runStreamed).toHaveBeenCalledTimes(1);
    expect(callbackOrder).toEqual([
      "reasoning_start:r-1:",
      "reasoning_delta:r-1:Thinking...",
      "reasoning_complete:r-1:Thinking... done.",
      "response_start:a-1:",
      'response_delta:a-1:{"answer":',
      "turn_complete",
    ]);
  });

  it("throws when streamed final response is empty", async () => {
    const runStreamed = vi.fn().mockResolvedValue({
      events: buildEventsStream([
        {
          type: "turn.completed",
          usage: {
            input_tokens: 1,
            cached_input_tokens: 0,
            output_tokens: 1,
          },
        },
      ]),
    });

    const thread = {
      runStreamed,
    } as unknown as Thread;

    await expect(runStreamedWithSchema(thread, "prompt", { type: "object" })).rejects.toThrow(
      "Codex returned an empty response for a schema-constrained run",
    );
  });

  it("throws when streamed final response is not JSON", async () => {
    const runStreamed = vi.fn().mockResolvedValue({
      events: buildEventsStream([
        { type: "item.completed", item: { id: "a-1", type: "agent_message", text: "not-json" } },
        {
          type: "turn.completed",
          usage: {
            input_tokens: 1,
            cached_input_tokens: 0,
            output_tokens: 1,
          },
        },
      ]),
    });

    const thread = {
      runStreamed,
    } as unknown as Thread;

    await expect(runStreamedWithSchema(thread, "prompt", { type: "object" })).rejects.toThrow(
      "Codex returned non-JSON schema response: not-json",
    );
  });
});
