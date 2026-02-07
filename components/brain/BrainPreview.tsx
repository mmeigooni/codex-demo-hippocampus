"use client";

import { useMemo } from "react";

import { BrainScene } from "@/components/brain/BrainScene";
import type { BrainEdgeModel, BrainNodeModel } from "@/components/brain/types";

export function BrainPreview() {
  const nodes = useMemo<BrainNodeModel[]>(
    () => [
      {
        id: "episode-1",
        type: "episode",
        label: "PII logging incident",
        salience: 9,
        triggers: ["pii", "logging", "checkout"],
      },
      {
        id: "episode-2",
        type: "episode",
        label: "Retry cascade warning",
        salience: 8,
        triggers: ["retry", "payments"],
      },
      {
        id: "rule-1",
        type: "rule",
        label: "Never log sensitive payloads",
        salience: 10,
        triggers: ["redaction", "compliance"],
      },
      {
        id: "rule-2",
        type: "rule",
        label: "Bound retries by error class",
        salience: 9,
        triggers: ["resilience", "rate-limit"],
      },
    ],
    [],
  );

  const edges = useMemo<BrainEdgeModel[]>(
    () => [
      { id: "edge-1", source: "episode-1", target: "rule-1", weight: 0.9 },
      { id: "edge-2", source: "episode-2", target: "rule-2", weight: 0.85 },
      { id: "edge-3", source: "episode-1", target: "rule-2", weight: 0.45 },
    ],
    [],
  );

  return <BrainScene nodes={nodes} edges={edges} />;
}
