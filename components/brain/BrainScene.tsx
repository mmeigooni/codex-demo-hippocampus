"use client";

import { useMemo, useState } from "react";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";

import { BrainGraph } from "@/components/brain/BrainGraph";
import { NodeInteraction } from "@/components/brain/NodeInteraction";
import { ParticleField } from "@/components/brain/ParticleField";
import type { BrainEdgeModel, BrainNodeModel, PositionedBrainNode } from "@/components/brain/types";

interface BrainSceneProps {
  nodes: BrainNodeModel[];
  edges: BrainEdgeModel[];
  layoutNodes?: BrainNodeModel[];
  layoutEdges?: BrainEdgeModel[];
}

export function BrainScene({ nodes, edges, layoutNodes, layoutEdges }: BrainSceneProps) {
  const [selectedNode, setSelectedNode] = useState<PositionedBrainNode | null>(null);

  const hasGraphData = useMemo(() => nodes.length > 0, [nodes.length]);

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="h-[440px] overflow-hidden rounded-xl border border-zinc-800 bg-[radial-gradient(circle_at_top,_#042f2e_0%,_#020617_65%)]">
        {hasGraphData ? (
          <Canvas camera={{ position: [0, 2, 10], fov: 55 }}>
            <color attach="background" args={["#020617"]} />
            <ambientLight intensity={0.45} />
            <pointLight position={[8, 8, 8]} intensity={0.75} color="#7dd3fc" />
            <pointLight position={[-8, -5, -5]} intensity={0.45} color="#fde68a" />

            <ParticleField />
            <BrainGraph
              nodes={nodes}
              edges={edges}
              layoutNodes={layoutNodes}
              layoutEdges={layoutEdges}
              onSelectedNodeChange={setSelectedNode}
            />

            <OrbitControls
              enablePan={false}
              enableRotate
              enableZoom
              minDistance={6}
              maxDistance={15}
              minPolarAngle={Math.PI * 0.2}
              maxPolarAngle={Math.PI * 0.78}
              autoRotate
              autoRotateSpeed={0.35}
            />
            <EffectComposer>
              <Bloom mipmapBlur luminanceThreshold={0.2} intensity={1.3} radius={0.65} />
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
