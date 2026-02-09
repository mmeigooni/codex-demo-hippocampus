"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

import { getColorFamilyForEpisode } from "@/lib/color/cluster-palette";

interface EpisodeNodeProps {
  nodeId: string;
  position: [number, number, number];
  salience: number;
  selected: boolean;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

export function EpisodeNode({ nodeId, position, salience, selected, onHover, onClick }: EpisodeNodeProps) {
  const groupRef = useRef<Group>(null);
  const spawnProgressRef = useRef(0);
  const intensity = 0.35 + salience / 10;
  const radius = 0.15 + (salience / 10) * 0.3;
  const baseScale = selected ? 1.25 : 1;
  const colorFamily = getColorFamilyForEpisode(nodeId);

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
          opacity={selected ? 0.08 : 0.06}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
