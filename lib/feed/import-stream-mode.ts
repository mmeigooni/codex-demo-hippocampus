import type { ImportEvent } from "@/lib/github/types";

export type ImportStreamMode = "unknown" | "live" | "replay";

const LIVE_SIGNAL_TYPES = new Set<ImportEvent["type"]>([
  "encoding_start",
  "episode_created",
  "episode_skipped",
  "encoding_error",
  "complete",
]);

export function hasReplayManifest(events: ImportEvent[]) {
  return events.some((event) => {
    if (event.type !== "replay_manifest") {
      return false;
    }

    const data = event.data as Record<string, unknown>;
    return data.mode === "import_replay";
  });
}

export function hasLiveSignal(events: ImportEvent[]) {
  return events.some((event) => LIVE_SIGNAL_TYPES.has(event.type));
}

export function stripReplayManifest(events: ImportEvent[]) {
  return events.filter((event) => event.type !== "replay_manifest");
}

export function resolveImportStreamMode(currentMode: ImportStreamMode, chunkEvents: ImportEvent[]): ImportStreamMode {
  if (currentMode === "replay") {
    return "replay";
  }

  if (currentMode === "live") {
    return "live";
  }

  if (hasReplayManifest(chunkEvents)) {
    return "replay";
  }

  if (hasLiveSignal(chunkEvents)) {
    return "live";
  }

  return "unknown";
}
