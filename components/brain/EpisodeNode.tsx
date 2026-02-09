"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

import type { PatternKey } from "@/lib/memory/pattern-taxonomy";
import { getColorFamilyForPatternKey } from "@/lib/color/cluster-palette";

interface EpisodeNodeProps {
  patternKey: string;
  position: [number, number, number];
  salience: number;
  selected: boolean;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

export function EpisodeNode({ patternKey, position, salience, selected, onHover, onClick }: EpisodeNodeProps) {
  const groupRef = useRef<Group>(null);
  const spawnProgressRef = useRef(0);
  const intensity = 0.35 + salience / 10;
  const radius = 0.15 + (salience / 10) * 0.3;
  const baseScale = selected ? 1.25 : 1;
  const colorFamily = getColorFamilyForPatternKey(patternKey as PatternKey);
  const normalizedSalience = Math.max(0, Math.min(10, salience));
  const glowOpacity = 0.03 + (normalizedSalience / 10) * 0.09;

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    if (spawnProgressRef.current >= 1) {
      return;
    }

    spawnProgressRef.current = Math.min(1, spawnProgressRef.current + delta * 3.5);
    const eased = 1 - Math.pow(1 - spawnProgressRef.current, 3);
    groupRef.current.scale.setScalar(eased * baseScale);
  });

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
          color={selected ? colorFamily.accent : colorFamily.border}
          emissive={selected ? colorFamily.accentMuted : colorFamily.bgMuted}
          emissiveIntensity={selected ? intensity + 0.35 : intensity}
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
          color={selected ? colorFamily.accent : colorFamily.border}
          transparent
          opacity={selected ? Math.min(0.14, glowOpacity + 0.02) : glowOpacity}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
