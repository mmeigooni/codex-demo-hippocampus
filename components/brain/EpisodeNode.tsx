"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, MeshBasicMaterial, MeshPhysicalMaterial } from "three";

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
  const coreMaterialRef = useRef<MeshPhysicalMaterial>(null);
  const glowMaterialRef = useRef<MeshBasicMaterial>(null);
  const spawnProgressRef = useRef(0);
  const pulseProgressRef = useRef(0);
  const lastPulseEpochRef = useRef(-1);
  const intensity = 0.35 + salience / 10;
  const radius = 0.12 + (salience / 10) * 0.23;
  const baseScale = selected ? 1.25 : 1;
  const colorFamily = getColorFamilyForPatternKey(patternKey as PatternKey);
  const normalizedSalience = Math.max(0, Math.min(10, salience));
  const glowOpacity = 0.03 + (normalizedSalience / 10) * 0.09;
  const baseEmissiveIntensity = selected ? intensity + 0.35 : intensity;
  const baseGlowOpacity = selected ? Math.min(0.14, glowOpacity + 0.02) : glowOpacity;

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

    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissiveIntensity = baseEmissiveIntensity + pulseIntensity;
    }

    if (glowMaterialRef.current) {
      glowMaterialRef.current.opacity = baseGlowOpacity + pulseIntensity * 0.08;
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
        <sphereGeometry args={[radius, 24, 24]} />
        <meshPhysicalMaterial
          ref={coreMaterialRef}
          color={selected ? colorFamily.accent : colorFamily.border}
          emissive={selected ? colorFamily.accentMuted : colorFamily.bgMuted}
          emissiveIntensity={baseEmissiveIntensity}
          clearcoat={0.8}
          clearcoatRoughness={0.25}
          roughness={0.35}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.08}>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial
          ref={glowMaterialRef}
          color={selected ? colorFamily.accent : colorFamily.border}
          transparent
          opacity={baseGlowOpacity}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
