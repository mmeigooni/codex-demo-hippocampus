"use client";

import { useEffect, useMemo, useState } from "react";

import { EpisodeNode } from "@/components/brain/EpisodeNode";
import { NeuralEdge } from "@/components/brain/NeuralEdge";
import { RuleNode } from "@/components/brain/RuleNode";
import type {
  BrainEdgeModel,
  BrainNodeModel,
  PositionedBrainNode,
} from "@/components/brain/types";

interface BrainGraphProps {
  nodes: BrainNodeModel[];
  edges: BrainEdgeModel[];
  layoutNodes?: BrainNodeModel[];
  layoutEdges?: BrainEdgeModel[];
  externalSelectedNodeId?: string | null;
  onSelectedNodeChange?: (node: PositionedBrainNode | null) => void;
  onNodeSelectionCommit?: (node: PositionedBrainNode | null) => void;
}

function computeLayoutNodes(nodes: BrainNodeModel[], edges: BrainEdgeModel[]) {
  const positions = new Map<string, [number, number, number]>();
  const vectors = new Map<string, { x: number; y: number; z: number }>();
  const attachedEdgesByNode = new Map<string, BrainEdgeModel[]>();

  for (const edge of edges) {
    const sourceAttached = attachedEdgesByNode.get(edge.source) ?? [];
    sourceAttached.push(edge);
    attachedEdgesByNode.set(edge.source, sourceAttached);

    const targetAttached = attachedEdgesByNode.get(edge.target) ?? [];
    targetAttached.push(edge);
    attachedEdgesByNode.set(edge.target, targetAttached);
  }

  nodes.forEach((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    const radius = node.type === "rule" ? 2.3 : 3.6;
    vectors.set(node.id, {
      x: Math.cos(angle) * radius,
      y: (index % 3) - 1,
      z: Math.sin(angle) * radius,
    });
  });

  for (let iteration = 0; iteration < 80; iteration += 1) {
    for (const node of nodes) {
      const current = vectors.get(node.id);
      if (!current) continue;

      let forceX = 0;
      let forceY = 0;
      let forceZ = 0;

      for (const other of nodes) {
        if (other.id === node.id) continue;
        const otherVector = vectors.get(other.id);
        if (!otherVector) continue;

        const dx = current.x - otherVector.x;
        const dy = current.y - otherVector.y;
        const dz = current.z - otherVector.z;
        const distSq = Math.max(0.01, dx * dx + dy * dy + dz * dz);
        const repulsion = 0.012 / distSq;

        forceX += dx * repulsion;
        forceY += dy * repulsion;
        forceZ += dz * repulsion;
      }

      const attached = attachedEdgesByNode.get(node.id) ?? [];
      for (const edge of attached) {
        const otherId = edge.source === node.id ? edge.target : edge.source;
        const otherVector = vectors.get(otherId);
        if (!otherVector) continue;

        forceX += (otherVector.x - current.x) * 0.004 * edge.weight;
        forceY += (otherVector.y - current.y) * 0.004 * edge.weight;
        forceZ += (otherVector.z - current.z) * 0.004 * edge.weight;
      }

      current.x += forceX;
      current.y += forceY;
      current.z += forceZ;
    }
  }

  for (const node of nodes) {
    const vector = vectors.get(node.id);
    if (!vector) continue;

    if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y) || !Number.isFinite(vector.z)) {
      positions.set(node.id, [0, 0, 0]);
      continue;
    }

    const magnitude = Math.hypot(vector.x, vector.y, vector.z);
    const maxRadius = 4.6;
    const scale = magnitude > maxRadius ? maxRadius / magnitude : 1;

    positions.set(node.id, [vector.x * scale, vector.y * scale, vector.z * scale]);
  }

  return positions;
}

export function BrainGraph({
  nodes,
  edges,
  layoutNodes,
  layoutEdges,
  externalSelectedNodeId,
  onSelectedNodeChange,
  onNodeSelectionCommit,
}: BrainGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const nodesForLayout = layoutNodes ?? nodes;
  const edgesForLayout = layoutEdges ?? edges;

  useEffect(() => {
    if (externalSelectedNodeId !== null && externalSelectedNodeId !== undefined) {
      setSelectedNodeId(null);
    }
  }, [externalSelectedNodeId]);

  const positions = useMemo(() => computeLayoutNodes(nodesForLayout, edgesForLayout), [edgesForLayout, nodesForLayout]);
  const positionedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        position: positions.get(node.id) ?? ([0, 0, 0] as [number, number, number]),
      })),
    [nodes, positions],
  );

  const effectiveSelectedId = externalSelectedNodeId ?? selectedNodeId;
  const selectedNode = positionedNodes.find((node) => node.id === effectiveSelectedId) ?? null;

  return (
    <group>
      {edges.map((edge) => {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);

        if (!source || !target) {
          return null;
        }

        return <NeuralEdge key={edge.id} from={source} to={target} weight={edge.weight} />;
      })}

      {positionedNodes.map((node) => {
        const isSelected = node.id === effectiveSelectedId;
        const isHovered = node.id === hoveredNodeId;

        const onHover = (hovered: boolean) => {
          setHoveredNodeId(hovered ? node.id : null);
          if (hovered) {
            onSelectedNodeChange?.(node);
          }
        };

        const onClick = () => {
          const nextSelectedId = effectiveSelectedId === node.id ? null : node.id;
          const nextSelectedNode = nextSelectedId ? node : null;

          if (externalSelectedNodeId === null || externalSelectedNodeId === undefined) {
            setSelectedNodeId(nextSelectedId);
          }

          onSelectedNodeChange?.(nextSelectedNode);
          onNodeSelectionCommit?.(nextSelectedNode);
        };

        if (node.type === "rule") {
          return (
            <RuleNode
              key={node.id}
              position={node.position}
              selected={isSelected || isHovered}
              onHover={onHover}
              onClick={onClick}
            />
          );
        }

        return (
          <EpisodeNode
            key={node.id}
            position={node.position}
            salience={node.salience}
            selected={isSelected || isHovered}
            onHover={onHover}
            onClick={onClick}
          />
        );
      })}

      {selectedNode ? (
        <mesh position={selectedNode.position}>
          <sphereGeometry args={[selectedNode.type === "rule" ? 0.6 : 0.5, 18, 18]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.08} />
        </mesh>
      ) : null}
    </group>
  );
}
