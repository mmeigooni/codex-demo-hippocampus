import { describe, expect, it } from "vitest";

import {
  hasLiveSignal,
  hasReplayManifest,
  resolveImportStreamMode,
  stripReplayManifest,
} from "@/lib/feed/import-stream-mode";
import type { ImportEvent } from "@/lib/github/types";

describe("import stream mode helpers", () => {
  it("keeps unknown when only pr_found is present", () => {
    const events: ImportEvent[] = [{ type: "pr_found", data: { count: 2 } }];

    expect(resolveImportStreamMode("unknown", events)).toBe("unknown");
    expect(hasLiveSignal(events)).toBe(false);
  });

  it("switches to replay when replay manifest appears after pr_found", () => {
    const firstChunk: ImportEvent[] = [{ type: "pr_found", data: { count: 2 } }];
    const secondChunk: ImportEvent[] = [{ type: "replay_manifest", data: { mode: "import_replay" } }];

    const firstMode = resolveImportStreamMode("unknown", firstChunk);
    const secondMode = resolveImportStreamMode(firstMode, secondChunk);

    expect(firstMode).toBe("unknown");
    expect(secondMode).toBe("replay");
    expect(hasReplayManifest(secondChunk)).toBe(true);
  });

  it("switches to live when live progression events appear", () => {
    const events: ImportEvent[] = [{ type: "encoding_start", data: { pr_number: 12 } }];

    expect(resolveImportStreamMode("unknown", events)).toBe("live");
    expect(hasLiveSignal(events)).toBe(true);
  });

  it("keeps live once live mode is established even if replay manifest appears later", () => {
    const liveEvents: ImportEvent[] = [{ type: "encoding_start", data: { pr_number: 12 } }];
    const manifestEvents: ImportEvent[] = [{ type: "replay_manifest", data: { mode: "import_replay" } }];

    const firstMode = resolveImportStreamMode("unknown", liveEvents);
    const secondMode = resolveImportStreamMode(firstMode, manifestEvents);

    expect(firstMode).toBe("live");
    expect(secondMode).toBe("live");
  });

  it("keeps replay once replay mode is established", () => {
    const laterEvents: ImportEvent[] = [{ type: "encoding_start", data: { pr_number: 44 } }];

    expect(resolveImportStreamMode("replay", laterEvents)).toBe("replay");
  });

  it("strips replay manifest events while preserving order of remaining events", () => {
    const events: ImportEvent[] = [
      { type: "pr_found", data: { count: 2 } },
      { type: "replay_manifest", data: { mode: "import_replay" } },
      { type: "encoding_start", data: { pr_number: 1 } },
      { type: "episode_created", data: { pr_number: 1, episode: { id: "ep-1" } } },
      { type: "complete", data: { total: 1, failed: 0, skipped: 0 } },
    ];

    const stripped = stripReplayManifest(events);

    expect(stripped.map((event) => event.type)).toEqual([
      "pr_found",
      "encoding_start",
      "episode_created",
      "complete",
    ]);
  });
});
