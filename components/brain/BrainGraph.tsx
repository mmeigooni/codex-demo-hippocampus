"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { EpisodeNode } from "@/components/brain/EpisodeNode";
import { NeuralEdge } from "@/components/brain/NeuralEdge";
import { ReplayOrchestrator } from "@/components/brain/ReplayOrchestrator";
import { RuleNode } from "@/components/brain/RuleNode";
import type { ConsolidationVisualState } from "@/components/brain/consolidation-visual-types";
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
  consolidationVisuals?: ConsolidationVisualState;
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
  consolidationVisuals,
  pulsingNodeIds,
  pulseEpoch,
  externalSelectedNodeId,
  onSelectedNodeChange,
  onNodeSelectionCommit,
}: BrainGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activatedNodeMap, setActivatedNodeMap] = useState<
    Map<string, "pulse" | "flash-warn" | "salience-shift">
  >(new Map());
  const [activatedNodeEpoch, setActivatedNodeEpoch] = useState(0);
  const [highlightedEdgePairs, setHighlightedEdgePairs] = useState<Set<string>>(new Set());
  const nodesForLayout = layoutNodes ?? nodes;
  const edgesForLayout = layoutEdges ?? edges;

  useEffect(() => {
    if (externalSelectedNodeId !== null && externalSelectedNodeId !== undefined) {
      const resetTimer = setTimeout(() => {
        setSelectedNodeId(null);
      }, 0);

      return () => {
        clearTimeout(resetTimer);
      };
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

  useEffect(() => {
    if (!onSelectedNodeChange) {
      return;
    }

    if (externalSelectedNodeId === null || externalSelectedNodeId === undefined) {
      onSelectedNodeChange(null);
      return;
    }

    const matchedNode = positionedNodes.find((node) => node.id === externalSelectedNodeId) ?? null;
    onSelectedNodeChange(matchedNode);
  }, [externalSelectedNodeId, onSelectedNodeChange, positionedNodes]);

  const handleActivateNode = useCallback((nodeId: string, mode: "pulse" | "flash-warn" | "salience-shift") => {
    setActivatedNodeMap((current) => {
      const next = new Map(current);
      next.set(nodeId, mode);
      return next;
    });
    setActivatedNodeEpoch((current) => current + 1);
  }, []);

  const handleHighlightEdge = useCallback((sourceId: string, targetId: string) => {
    setHighlightedEdgePairs((current) => {
      const next = new Set(current);
      next.add(`${sourceId}->${targetId}`);
      next.add(`${targetId}->${sourceId}`);
      return next;
    });
  }, []);

  const handleClearEffects = useCallback(() => {
    setActivatedNodeMap(new Map());
    setHighlightedEdgePairs(new Set());
  }, []);

  const getEdgeColor = useCallback(
    (nodeId: string) => {
      const node = nodeById.get(nodeId);
      return getColorFamilyForPatternKey(node?.patternKey as PatternKey).border;
    },
    [nodeById],
  );

  const activeCommand = consolidationVisuals?.activeCommand ?? null;
  const activeCommandNodeIds = useMemo(() => {
    if (!activeCommand) {
      return new Set<string>();
    }

    switch (activeCommand.kind) {
      case "replay-chain":
        return new Set(activeCommand.episodeNodeIds);
      case "rule-promotion":
        return new Set([...activeCommand.sourceEpisodeNodeIds, activeCommand.ruleNodeId]);
      case "salience-shift":
        return new Set([activeCommand.episodeNodeId]);
      case "contradiction-flash":
        return new Set([activeCommand.leftNodeId, activeCommand.rightNodeId]);
      default:
        return new Set<string>();
    }
  }, [activeCommand]);

  const activeEdges = useMemo(() => {
    if (!activeNodeId) {
      return [];
    }

    return edges.filter((edge) => edge.source === activeNodeId || edge.target === activeNodeId);
  }, [activeNodeId, edges]);

  const consolidationEdges = useMemo(() => {
    if (activeCommandNodeIds.size < 2) {
      return [];
    }

    return edges.filter(
      (edge) => activeCommandNodeIds.has(edge.source) && activeCommandNodeIds.has(edge.target),
    );
  }, [activeCommandNodeIds, edges]);

  const visibleEdges = useMemo(() => {
    const byId = new Map<string, BrainEdgeModel>();

    for (const edge of activeEdges) {
      byId.set(edge.id, edge);
    }

    for (const edge of consolidationEdges) {
      byId.set(edge.id, edge);
    }

    return Array.from(byId.values());
  }, [activeEdges, consolidationEdges]);

  return (
    <group>
      {visibleEdges.map((edge) => {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);

        if (!source || !target) {
          return null;
        }

        return (
          <NeuralEdge
            key={edge.id}
            from={source}
            to={target}
            weight={edge.weight}
            color={getEdgeColor(edge.source)}
            highlighted={highlightedEdgePairs.has(`${edge.source}->${edge.target}`)}
          />
        );
      })}

      <ReplayOrchestrator
        command={consolidationVisuals?.activeCommand ?? null}
        commandEpoch={consolidationVisuals?.commandEpoch ?? 0}
        positions={positions}
        onActivateNode={handleActivateNode}
        onHighlightEdge={handleHighlightEdge}
        onClearEffects={handleClearEffects}
        getEdgeColor={getEdgeColor}
      />

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
              burstActive={activatedNodeMap.has(node.id)}
              burstEpoch={activatedNodeEpoch}
              onHover={onHover}
              onClick={onClick}
            />
          );
        }

        return (
          <EpisodeNode
            key={node.id}
            nodeId={node.id}
            patternKey={node.patternKey}
            position={node.position}
            salience={node.salience}
            selected={isSelected || isHovered}
            activationMode={activatedNodeMap.get(node.id) ?? null}
            activationEpoch={activatedNodeEpoch}
            pulsing={pulsingNodeIds?.has(node.id) ?? false}
            pulseEpoch={pulseEpoch}
            onHover={onHover}
            onClick={onClick}
          />
        );
      })}

    </group>
  );
}
