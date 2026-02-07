"use client";

import type { PositionedBrainNode } from "@/components/brain/types";

interface NodeInteractionProps {
  node: PositionedBrainNode | null;
}

export function NodeInteraction({ node }: NodeInteractionProps) {
  if (!node) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-300">
        Hover or click a node to inspect episode/rule context.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-200">
      <p className="font-semibold text-zinc-100">{node.label}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-zinc-400">{node.type}</p>
      <p className="mt-2 text-sm text-zinc-300">Salience: {node.salience}</p>
      <p className="mt-2 text-xs text-cyan-200">Triggers: {node.triggers.join(", ") || "none"}</p>
    </div>
  );
}
