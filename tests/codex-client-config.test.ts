import { beforeEach, describe, expect, it, vi } from "vitest";

const startThreadMock = vi.fn(() => ({ id: null }));
const codexConstructorSpy = vi.fn();

class CodexMock {
  constructor() {
    codexConstructorSpy();
  }

  startThread = startThreadMock;
}

vi.mock("@openai/codex-sdk", () => ({
  Codex: CodexMock,
}));

describe("createCodexThread", () => {
  beforeEach(() => {
    vi.resetModules();
    startThreadMock.mockClear();
    codexConstructorSpy.mockClear();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("uses high reasoning effort for consolidation threads", async () => {
    const { createCodexThread } = await import("@/lib/codex/client");
    createCodexThread("consolidation");

    expect(startThreadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5",
        modelReasoningEffort: "high",
      }),
    );
  });

  it("uses medium reasoning effort for mini threads", async () => {
    const { createCodexThread } = await import("@/lib/codex/client");
    createCodexThread("mini");

    expect(startThreadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5-mini",
        modelReasoningEffort: "medium",
      }),
    );
  });
});
