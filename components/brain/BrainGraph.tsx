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
import { getColorFamilyForPatternKey } from "@/lib/color/cluster-palette";
import {
  getSuperCategoryForPattern,
  type PatternKey,
  SUPER_CATEGORY_KEYS,
  type SuperCategory,
} from "@/lib/memory/pattern-taxonomy";

interface BrainGraphProps {
  nodes: BrainNodeModel[];
  edges: BrainEdgeModel[];
  layoutNodes?: BrainNodeModel[];
  layoutEdges?: BrainEdgeModel[];
  pulsingNodeIds?: Set<string> | null;
  pulseEpoch?: number;
  externalSelectedNodeId?: string | null;
  onSelectedNodeChange?: (node: PositionedBrainNode | null) => void;
  onNodeSelectionCommit?: (node: PositionedBrainNode | null) => void;
}

function computeLayoutNodes(nodes: BrainNodeModel[], edges: BrainEdgeModel[]) {
  const positions = new Map<string, [number, number, number]>();
  const vectors = new Map<string, { x: number; y: number; z: number }>();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const islandCenterByCategory = new Map<SuperCategory, { x: number; y: number; z: number }>();
  const ruleAnchorById = new Map<string, { x: number; y: number; z: number }>();
  const groupedNodes = new Map<SuperCategory, { rules: BrainNodeModel[]; episodes: BrainNodeModel[] }>(
    SUPER_CATEGORY_KEYS.map((category) => [category, { rules: [], episodes: [] }] as const),
  );

  const islandRadius = 3.2;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const resolveSuperCategory = (node: BrainNodeModel): SuperCategory => {
    const mapped = getSuperCategoryForPattern(node.patternKey as PatternKey) as SuperCategory | undefined;
    if (mapped && SUPER_CATEGORY_KEYS.includes(mapped)) {
      return mapped;
    }

    return "flow";
  };

  for (const [index, category] of SUPER_CATEGORY_KEYS.entries()) {
    const angle = (index / SUPER_CATEGORY_KEYS.length) * Math.PI * 2;
    islandCenterByCategory.set(category, {
      x: Math.cos(angle) * islandRadius,
      y: 0,
      z: Math.sin(angle) * islandRadius,
    });
  }

  for (const node of nodes) {
    const category = resolveSuperCategory(node);
    const grouped = groupedNodes.get(category);
    if (!grouped) continue;

    if (node.type === "rule") {
      grouped.rules.push(node);
    } else {
      grouped.episodes.push(node);
    }
  }

  const connectedRuleIdByEpisode = new Map<string, string>();
  for (const edge of edges) {
    if (connectedRuleIdByEpisode.has(edge.source) || connectedRuleIdByEpisode.has(edge.target)) {
      continue;
    }

    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);

    if (sourceNode?.type === "episode" && targetNode?.type === "rule") {
      connectedRuleIdByEpisode.set(sourceNode.id, targetNode.id);
    } else if (sourceNode?.type === "rule" && targetNode?.type === "episode") {
      connectedRuleIdByEpisode.set(targetNode.id, sourceNode.id);
    }
  }

  for (const category of SUPER_CATEGORY_KEYS) {
    const grouped = groupedNodes.get(category);
    const islandCenter = islandCenterByCategory.get(category);
    if (!grouped || !islandCenter) {
      continue;
    }

    const ruleCount = grouped.rules.length;
    const ruleRingRadius = ruleCount <= 1 ? 0.4 : 0.7;

    grouped.rules.forEach((rule, index) => {
      const angle = (index / Math.max(ruleCount, 1)) * Math.PI * 2;
      const yOffset = ruleCount > 1 ? (index % 2 === 0 ? 0.08 : -0.08) : 0;

      const vector = {
        x: islandCenter.x + Math.cos(angle) * ruleRingRadius,
        y: islandCenter.y + yOffset,
        z: islandCenter.z + Math.sin(angle) * ruleRingRadius,
      };

      vectors.set(rule.id, vector);
      ruleAnchorById.set(rule.id, vector);
    });
  }

  for (const category of SUPER_CATEGORY_KEYS) {
    const grouped = groupedNodes.get(category);
    const islandCenter = islandCenterByCategory.get(category);
    if (!grouped || !islandCenter) {
      continue;
    }

    const episodesByAnchor = new Map<string, BrainNodeModel[]>();

    for (const episode of grouped.episodes) {
      const connectedRuleId = connectedRuleIdByEpisode.get(episode.id);
      const anchorId = connectedRuleId && ruleAnchorById.has(connectedRuleId) ? connectedRuleId : "__island__";
      const anchorEpisodes = episodesByAnchor.get(anchorId) ?? [];
      anchorEpisodes.push(episode);
      episodesByAnchor.set(anchorId, anchorEpisodes);
    }

    for (const [anchorId, episodesForAnchor] of episodesByAnchor) {
      const anchor = anchorId === "__island__" ? islandCenter : (ruleAnchorById.get(anchorId) ?? islandCenter);
      const episodeCount = episodesForAnchor.length;

      episodesForAnchor.forEach((episode, index) => {
        const theta = index * goldenAngle;
        const phi = Math.acos(1 - (2 * (index + 0.5)) / Math.max(episodeCount, 1));
        const radius = anchorId === "__island__" ? 1.0 : 0.9 + (index % 3) * 0.2;

        vectors.set(episode.id, {
          x: anchor.x + radius * Math.sin(phi) * Math.cos(theta),
          y: anchor.y + radius * Math.cos(phi),
          z: anchor.z + radius * Math.sin(phi) * Math.sin(theta),
        });
      });
    }
  }

  for (const node of nodes) {
    const vector = vectors.get(node.id);

    const fallbackVector = (() => {
      if (vector) {
        return vector;
      }

      const category = resolveSuperCategory(node);
      return islandCenterByCategory.get(category) ?? { x: 0, y: 0, z: 0 };
    })();

    if (
      !Number.isFinite(fallbackVector.x) ||
      !Number.isFinite(fallbackVector.y) ||
      !Number.isFinite(fallbackVector.z)
    ) {
      positions.set(node.id, [0, 0, 0]);
      continue;
    }

    const magnitude = Math.hypot(fallbackVector.x, fallbackVector.y, fallbackVector.z);
    const maxRadius = 4.6;
    const scale = magnitude > maxRadius ? maxRadius / magnitude : 1;

    positions.set(node.id, [fallbackVector.x * scale, fallbackVector.y * scale, fallbackVector.z * scale]);
  }

  return positions;
}

export function BrainGraph({
  nodes,
  edges,
  layoutNodes,
  layoutEdges,
  pulsingNodeIds,
  pulseEpoch,
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
  const activeNodeId = hoveredNodeId ?? effectiveSelectedId;
  const selectedNode = positionedNodes.find((node) => node.id === effectiveSelectedId) ?? null;
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const activeEdges = useMemo(() => {
    if (!activeNodeId) {
      return [];
    }

    return edges.filter((edge) => edge.source === activeNodeId || edge.target === activeNodeId);
  }, [activeNodeId, edges]);

  return (
    <group>
      {activeEdges.map((edge) => {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        const sourceNode = nodeById.get(edge.source);

        if (!source || !target) {
          return null;
        }

        const edgeColor = getColorFamilyForPatternKey(sourceNode?.patternKey as PatternKey).border;

        return <NeuralEdge key={edge.id} from={source} to={target} weight={edge.weight} color={edgeColor} />;
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
              patternKey={node.patternKey}
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
            patternKey={node.patternKey}
            position={node.position}
            salience={node.salience}
            selected={isSelected || isHovered}
            pulsing={pulsingNodeIds?.has(node.id) ?? false}
            pulseEpoch={pulseEpoch}
            onHover={onHover}
            onClick={onClick}
          />
        );
      })}

      {selectedNode ? (
        <mesh position={selectedNode.position}>
          <sphereGeometry args={[selectedNode.type === "rule" ? 0.9 : 0.5, 18, 18]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.08} />
        </mesh>
      ) : null}
    </group>
  );
}
