"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, MeshBasicMaterial } from "three";

import type { PatternKey } from "@/lib/memory/pattern-taxonomy";
import { getColorFamilyForPatternKey } from "@/lib/color/cluster-palette";

interface EpisodeNodeProps {
  patternKey: string;
  position: [number, number, number];
  salience: number;
  selected: boolean;
  pulsing?: boolean;
  pulseEpoch?: number;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

export function EpisodeNode({
  patternKey,
  position,
  salience,
  selected,
  pulsing,
  pulseEpoch,
  onHover,
  onClick,
}: EpisodeNodeProps) {
  const groupRef = useRef<Group>(null);
  const latticeMaterialRef = useRef<MeshBasicMaterial>(null);
  const haloMaterialRef = useRef<MeshBasicMaterial>(null);
  const spawnProgressRef = useRef(0);
  const pulseProgressRef = useRef(0);
  const lastPulseEpochRef = useRef(-1);
  const radius = 0.32 + (salience / 10) * 0.04;
  const baseScale = selected ? 1.25 : 1;
  const colorFamily = getColorFamilyForPatternKey(patternKey as PatternKey);
  const normalizedSalience = Math.max(0, Math.min(10, salience));
  const latticeOpacity = 0.2 + (normalizedSalience / 10) * 0.18;
  const baseLatticeOpacity = selected ? Math.min(0.55, latticeOpacity + 0.09) : latticeOpacity;
  const baseHaloOpacity = selected ? 0.2 : 0.12;

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    let pulseIntensity = 0;

    if (spawnProgressRef.current < 1) {
      spawnProgressRef.current = Math.min(1, spawnProgressRef.current + delta * 3.5);
      const eased = 1 - Math.pow(1 - spawnProgressRef.current, 3);
      groupRef.current.scale.setScalar(eased * baseScale);
    }

    if (pulseProgressRef.current > 0 && pulseProgressRef.current < 1) {
      pulseProgressRef.current = Math.min(1, pulseProgressRef.current + delta / 1.5);
      const pulseScale = Math.sin(pulseProgressRef.current * Math.PI);
      pulseIntensity = pulseScale * 0.6;
      groupRef.current.scale.setScalar(baseScale * (1 + pulseScale * 0.15));
    } else if (pulseProgressRef.current >= 1) {
      pulseProgressRef.current = 0;
      groupRef.current.scale.setScalar(baseScale);
    }

    if (latticeMaterialRef.current) {
      latticeMaterialRef.current.opacity = Math.min(0.6, baseLatticeOpacity + pulseIntensity * 0.08);
    }

    if (haloMaterialRef.current) {
      haloMaterialRef.current.opacity = Math.min(0.3, baseHaloOpacity + pulseIntensity * 0.09);
    }
  });

  useEffect(() => {
    if (pulsing && pulseEpoch !== undefined && pulseEpoch !== lastPulseEpochRef.current) {
      pulseProgressRef.current = 0.001;
      lastPulseEpochRef.current = pulseEpoch;
    }
  }, [pulsing, pulseEpoch]);

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }

    if (spawnProgressRef.current >= 1) {
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
      <mesh>
        <icosahedronGeometry args={[radius, 1]} />
        <meshBasicMaterial
          ref={latticeMaterialRef}
          wireframe
          color={selected ? colorFamily.accent : colorFamily.border}
          transparent
          opacity={baseLatticeOpacity}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.12}>
        <icosahedronGeometry args={[radius, 1]} />
        <meshBasicMaterial
          ref={haloMaterialRef}
          color={selected ? colorFamily.accent : colorFamily.border}
          wireframe
          transparent
          opacity={baseHaloOpacity}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
