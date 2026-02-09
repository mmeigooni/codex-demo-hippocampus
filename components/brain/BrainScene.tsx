"use client";

import { useMemo, useRef, useState, type ComponentType, type ComponentProps, type RefObject } from "react";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { MathUtils } from "three";

import { BrainGraph } from "@/components/brain/BrainGraph";
import { NodeInteraction } from "@/components/brain/NodeInteraction";
import { ParticleField } from "@/components/brain/ParticleField";
import type { ConsolidationVisualState } from "@/components/brain/consolidation-visual-types";
import type { BrainEdgeModel, BrainNodeModel, PositionedBrainNode } from "@/components/brain/types";

interface BrainSceneProps {
  nodes: BrainNodeModel[];
  edges: BrainEdgeModel[];
  layoutNodes?: BrainNodeModel[];
  layoutEdges?: BrainEdgeModel[];
  pulsingNodeIds?: Set<string> | null;
  pulseEpoch?: number;
  consolidationVisuals?: ConsolidationVisualState;
  externalSelectedNodeId?: string | null;
  onNodeSelectionCommit?: (node: PositionedBrainNode | null) => void;
}

type BrainGraphPropsWithVisuals = ComponentProps<typeof BrainGraph> & {
  consolidationVisuals?: ConsolidationVisualState;
};

const BrainGraphWithVisuals = BrainGraph as unknown as ComponentType<BrainGraphPropsWithVisuals>;

interface AtmosphereControllerProps {
  isConsolidating: boolean;
  bloomRef: RefObject<{ intensity: number } | null>;
  ambientRef: RefObject<{ intensity: number } | null>;
}

function AtmosphereController({ isConsolidating, bloomRef, ambientRef }: AtmosphereControllerProps) {
  useFrame((_, delta) => {
    const alpha = Math.min(1, delta * 2);

    if (bloomRef.current) {
      const targetBloomIntensity = isConsolidating ? 1.4 : 1.0;
      bloomRef.current.intensity = MathUtils.lerp(
        bloomRef.current.intensity,
        targetBloomIntensity,
        alpha,
      );
    }

    if (ambientRef.current) {
      const targetAmbientIntensity = isConsolidating ? 0.28 : 0.45;
      ambientRef.current.intensity = MathUtils.lerp(
        ambientRef.current.intensity,
        targetAmbientIntensity,
        alpha,
      );
    }
  });

  return null;
}

export function BrainScene({
  nodes,
  edges,
  layoutNodes,
  layoutEdges,
  pulsingNodeIds,
  pulseEpoch,
  consolidationVisuals,
  externalSelectedNodeId,
  onNodeSelectionCommit,
}: BrainSceneProps) {
  const [selectedNode, setSelectedNode] = useState<PositionedBrainNode | null>(null);
  const bloomRef = useRef<{ intensity: number } | null>(null);
  const ambientRef = useRef<{ intensity: number } | null>(null);

  const hasGraphData = useMemo(() => nodes.length > 0, [nodes.length]);

  return (
    <div className="space-y-3">
      <div className="h-[440px] overflow-hidden rounded-xl border border-zinc-800 bg-[radial-gradient(circle_at_top,_#042f2e_0%,_#020617_65%)]">
        {hasGraphData ? (
          <Canvas camera={{ position: [0, 2, 10], fov: 55 }}>
            <color attach="background" args={["#020617"]} />
            <ambientLight ref={ambientRef} intensity={0.45} />
            <pointLight position={[8, 8, 8]} intensity={0.75} color="#7dd3fc" />
            <pointLight position={[-8, -5, -5]} intensity={0.45} color="#fde68a" />
            <AtmosphereController
              isConsolidating={consolidationVisuals?.isConsolidating ?? false}
              bloomRef={bloomRef}
              ambientRef={ambientRef}
            />

            <ParticleField isConsolidating={consolidationVisuals?.isConsolidating} />
            <BrainGraphWithVisuals
              nodes={nodes}
              edges={edges}
              layoutNodes={layoutNodes}
              layoutEdges={layoutEdges}
              pulsingNodeIds={pulsingNodeIds}
              pulseEpoch={pulseEpoch}
              consolidationVisuals={consolidationVisuals}
              externalSelectedNodeId={externalSelectedNodeId}
              onSelectedNodeChange={setSelectedNode}
              onNodeSelectionCommit={onNodeSelectionCommit}
            />

            <OrbitControls
              enablePan={false}
              enableRotate
              enableZoom
              minDistance={5}
              maxDistance={15}
              minPolarAngle={Math.PI * 0.2}
              maxPolarAngle={Math.PI * 0.78}
              autoRotate
              autoRotateSpeed={consolidationVisuals?.isConsolidating ? 0.15 : 0.35}
            />
            <EffectComposer>
              <Bloom ref={bloomRef} mipmapBlur luminanceThreshold={0.25} intensity={1.0} radius={0.65} />
            </EffectComposer>
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-sm text-zinc-400">
            No nodes yet. Import episodes to activate the memory graph.
          </div>
        )}
      </div>

      <NodeInteraction node={selectedNode} />
    </div>
  );
}
