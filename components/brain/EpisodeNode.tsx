"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type {
  Group,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PointsMaterial,
} from "three";
import { Color } from "three";

import { createFracturedHexPrism } from "@/components/brain/geometry/fractured-prism";
import { getColorFamilyForPatternKey } from "@/lib/color/cluster-palette";
import type { PatternKey } from "@/lib/memory/pattern-taxonomy";

type ActivationMode = "pulse" | "flash-warn" | "salience-shift";

interface EpisodeNodeProps {
  nodeId: string;
  patternKey: string;
  position: [number, number, number];
  salience: number;
  selected: boolean;
  activationMode?: ActivationMode | null;
  activationEpoch?: number;
  pulsing?: boolean;
  pulseEpoch?: number;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

function getBreathingPhase(nodeId: string): number {
  let hash = 0;

  for (let i = 0; i < nodeId.length; i += 1) {
    hash = ((hash << 5) - hash) + nodeId.charCodeAt(i);
    hash |= 0;
  }

  return (Math.abs(hash) % 628) / 100;
}

export function EpisodeNode({
  nodeId,
  patternKey,
  position,
  salience,
  selected,
  activationMode,
  activationEpoch,
  pulsing,
  pulseEpoch,
  onHover,
  onClick,
}: EpisodeNodeProps) {
  const groupRef = useRef<Group>(null);
  const fillMaterialRef = useRef<MeshBasicMaterial>(null);
  const edgeMaterialRef = useRef<LineBasicMaterial>(null);
  const vertexMaterialRef = useRef<PointsMaterial>(null);
  const rippleRingRef = useRef<Mesh>(null);
  const rippleMaterialRef = useRef<MeshBasicMaterial>(null);

  const spawnProgressRef = useRef(0);
  const pulseProgressRef = useRef(0);
  const flashProgressRef = useRef(0);
  const salienceProgressRef = useRef(0);
  const rippleProgressRef = useRef(0);

  const lastPulseEpochRef = useRef(-1);
  const lastFlashEpochRef = useRef(-1);
  const lastSalienceEpochRef = useRef(-1);
  const salienceStartOpacityRef = useRef(0);

  const baseFillColorRef = useRef("");
  const baseEdgeColorRef = useRef("");
  const baseVertexColorRef = useRef("");

  const prismRadius = 0.14;
  const prismHeight = 0.2;
  const baseScale = selected ? 1.25 : 1;
  const breathingPhase = useMemo(() => getBreathingPhase(nodeId), [nodeId]);

  const colorFamily = getColorFamilyForPatternKey(patternKey as PatternKey);
  const normalizedSalience = Math.max(0, Math.min(10, salience));

  const fillOpacity = 0.45 + (normalizedSalience / 10) * 0.33;
  const baseFillOpacity = selected ? Math.min(0.9, fillOpacity + 0.08) : fillOpacity;
  const baseEdgeOpacity = selected ? 0.95 : 0.8;
  const baseVertexOpacity = selected ? 0.98 : 0.86;

  const baseFillColor = selected ? colorFamily.accent : colorFamily.border;
  const baseEdgeColor = useMemo(
    () => new Color(baseFillColor).multiplyScalar(0.66).getStyle(),
    [baseFillColor],
  );
  const baseVertexColor = useMemo(
    () => new Color(baseFillColor).multiplyScalar(0.56).getStyle(),
    [baseFillColor],
  );

  const removalFraction = 0.75 - (normalizedSalience / 10) * 0.4;
  const fracturedPrism = useMemo(
    () => createFracturedHexPrism(prismRadius, prismHeight, nodeId, removalFraction),
    [nodeId, prismHeight, prismRadius, removalFraction],
  );

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    let pulseIntensity = 0;
    let pulseScaleBoost = 0;
    let fillOpacityValue = baseFillOpacity;
    let edgeOpacityValue = baseEdgeOpacity;
    let vertexOpacityValue = baseVertexOpacity;
    let shakeOffsetX = 0;

    if (spawnProgressRef.current < 1) {
      spawnProgressRef.current = Math.min(1, spawnProgressRef.current + delta * 3.5);
    }

    if (pulseProgressRef.current > 0 && pulseProgressRef.current < 1) {
      pulseProgressRef.current = Math.min(1, pulseProgressRef.current + delta / 1.5);
      const pulseScale = Math.sin(pulseProgressRef.current * Math.PI);
      pulseIntensity = pulseScale;
      pulseScaleBoost = pulseScale * 0.12;
    } else if (pulseProgressRef.current >= 1) {
      pulseProgressRef.current = 0;
    }

    if (flashProgressRef.current > 0 && flashProgressRef.current < 1) {
      flashProgressRef.current = Math.min(1, flashProgressRef.current + delta / 0.6);
      shakeOffsetX = Math.sin(flashProgressRef.current * Math.PI * 6) * 0.08;

      fillMaterialRef.current?.color.set("#ff6b35");
      edgeMaterialRef.current?.color.set("#ff6b35");
      vertexMaterialRef.current?.color.set("#ff6b35");

      if (flashProgressRef.current >= 1) {
        flashProgressRef.current = 0;
        fillMaterialRef.current?.color.set(baseFillColorRef.current);
        edgeMaterialRef.current?.color.set(baseEdgeColorRef.current);
        vertexMaterialRef.current?.color.set(baseVertexColorRef.current);
      }
    }

    if (salienceProgressRef.current > 0 && salienceProgressRef.current < 1) {
      salienceProgressRef.current = Math.min(1, salienceProgressRef.current + delta / 0.8);
      const t = salienceProgressRef.current;
      const lerpedBase = salienceStartOpacityRef.current + (baseFillOpacity - salienceStartOpacityRef.current) * t;
      fillOpacityValue = Math.min(0.9, lerpedBase * (1 + 0.15 * Math.sin(t * Math.PI)));
      edgeOpacityValue = Math.min(1, baseEdgeOpacity + 0.06 * Math.sin(t * Math.PI));
      vertexOpacityValue = Math.min(1, baseVertexOpacity + 0.08 * Math.sin(t * Math.PI));

      if (salienceProgressRef.current >= 1) {
        salienceProgressRef.current = 0;
      }
    }

    if (rippleProgressRef.current > 0 && rippleProgressRef.current < 1) {
      rippleProgressRef.current = Math.min(1, rippleProgressRef.current + delta / 0.8);
      const t = rippleProgressRef.current;

      if (rippleRingRef.current) {
        rippleRingRef.current.visible = true;
        rippleRingRef.current.scale.setScalar(Math.max(0.001, 1.5 * t));
      }

      if (rippleMaterialRef.current) {
        rippleMaterialRef.current.opacity = Math.max(0, 0.5 * (1 - t));
      }

      if (rippleProgressRef.current >= 1) {
        rippleProgressRef.current = 0;
        if (rippleRingRef.current) {
          rippleRingRef.current.visible = false;
          rippleRingRef.current.scale.setScalar(0.001);
        }
        if (rippleMaterialRef.current) {
          rippleMaterialRef.current.opacity = 0;
        }
      }
    }

    const breathingScale = 1 + Math.sin(state.clock.elapsedTime * 1.1 + breathingPhase) * 0.014;
    const easedSpawn = 1 - Math.pow(1 - spawnProgressRef.current, 3);
    const scaleMultiplier = breathingScale * (1 + pulseScaleBoost);

    group.scale.setScalar(baseScale * scaleMultiplier * easedSpawn);
    group.position.set(position[0] + shakeOffsetX, position[1], position[2]);

    if (fillMaterialRef.current) {
      fillMaterialRef.current.opacity = Math.min(0.95, fillOpacityValue + pulseIntensity * 0.08);
    }

    if (edgeMaterialRef.current) {
      edgeMaterialRef.current.opacity = Math.min(1, edgeOpacityValue + pulseIntensity * 0.05);
    }

    if (vertexMaterialRef.current) {
      vertexMaterialRef.current.opacity = Math.min(1, vertexOpacityValue + pulseIntensity * 0.07);
    }
  });

  useEffect(() => {
    baseFillColorRef.current = baseFillColor;
    baseEdgeColorRef.current = baseEdgeColor;
    baseVertexColorRef.current = baseVertexColor;

    if (flashProgressRef.current === 0) {
      fillMaterialRef.current?.color.set(baseFillColor);
      edgeMaterialRef.current?.color.set(baseEdgeColor);
      vertexMaterialRef.current?.color.set(baseVertexColor);
    }
  }, [baseEdgeColor, baseFillColor, baseVertexColor]);

  useEffect(() => {
    if (rippleRingRef.current) {
      rippleRingRef.current.visible = false;
      rippleRingRef.current.scale.setScalar(0.001);
    }
  }, []);

  useEffect(() => {
    return () => {
      fracturedPrism.solidGeometry.dispose();
      fracturedPrism.edgeGeometry.dispose();
      fracturedPrism.pointGeometry.dispose();
    };
  }, [fracturedPrism]);

  useEffect(() => {
    const shouldUseLegacyPulse = activationMode === undefined || activationMode === null;
    const nextPulseEpoch = shouldUseLegacyPulse ? pulseEpoch : activationMode === "pulse" ? activationEpoch : undefined;
    const shouldTriggerPulse = shouldUseLegacyPulse ? pulsing : activationMode === "pulse";

    if (shouldTriggerPulse && nextPulseEpoch !== undefined && nextPulseEpoch !== lastPulseEpochRef.current) {
      pulseProgressRef.current = 0.001;
      lastPulseEpochRef.current = nextPulseEpoch;
    }
  }, [activationEpoch, activationMode, pulseEpoch, pulsing]);

  useEffect(() => {
    if (
      activationMode === "flash-warn" &&
      activationEpoch !== undefined &&
      activationEpoch !== lastFlashEpochRef.current
    ) {
      flashProgressRef.current = 0.001;
      lastFlashEpochRef.current = activationEpoch;
    }
  }, [activationEpoch, activationMode]);

  useEffect(() => {
    if (
      activationMode === "salience-shift" &&
      activationEpoch !== undefined &&
      activationEpoch !== lastSalienceEpochRef.current
    ) {
      salienceStartOpacityRef.current = fillMaterialRef.current?.opacity ?? baseFillOpacity;
      salienceProgressRef.current = 0.001;
      rippleProgressRef.current = 0.001;
      lastSalienceEpochRef.current = activationEpoch;
    }
  }, [activationEpoch, activationMode, baseFillOpacity]);

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }

    if (spawnProgressRef.current >= 1 && pulseProgressRef.current === 0) {
      groupRef.current.scale.setScalar(baseScale);
    }
  }, [baseScale]);

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={() => onHover(true)}
      onPointerOut={() => onHover(false)}
      onClick={onClick}
    >
      <mesh geometry={fracturedPrism.solidGeometry}>
        <meshBasicMaterial
          ref={fillMaterialRef}
          color={baseFillColor}
          transparent
          opacity={baseFillOpacity}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      <lineSegments geometry={fracturedPrism.edgeGeometry}>
        <lineBasicMaterial
          ref={edgeMaterialRef}
          color={baseEdgeColor}
          transparent
          opacity={baseEdgeOpacity}
          toneMapped={false}
          depthWrite={false}
        />
      </lineSegments>

      <points geometry={fracturedPrism.pointGeometry}>
        <pointsMaterial
          ref={vertexMaterialRef}
          color={baseVertexColor}
          size={0.024}
          sizeAttenuation
          transparent
          opacity={baseVertexOpacity}
          toneMapped={false}
          depthWrite={false}
        />
      </points>

      <mesh ref={rippleRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.13, 0.17, 24]} />
        <meshBasicMaterial
          ref={rippleMaterialRef}
          color={colorFamily.accent}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
