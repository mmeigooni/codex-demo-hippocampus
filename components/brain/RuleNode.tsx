"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

import type { PatternKey } from "@/lib/memory/pattern-taxonomy";
import { getColorFamilyForPatternKey } from "@/lib/color/cluster-palette";

interface RuleNodeProps {
  patternKey: string;
  position: [number, number, number];
  selected: boolean;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

export function RuleNode({ patternKey, position, selected, onHover, onClick }: RuleNodeProps) {
  const groupRef = useRef<Group>(null);
  const spawnProgressRef = useRef(0);
  const baseScale = selected ? 1.25 : 1;
  const colorFamily = getColorFamilyForPatternKey(patternKey as PatternKey);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    if (spawnProgressRef.current < 1) {
      spawnProgressRef.current = Math.min(1, spawnProgressRef.current + delta * 3.5);
      const eased = 1 - Math.pow(1 - spawnProgressRef.current, 3);
      groupRef.current.scale.setScalar(eased * baseScale);
    }

    groupRef.current.rotation.y += delta * 0.3;
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
        <octahedronGeometry args={[0.65, 0]} />
        <meshPhysicalMaterial
          color={selected ? colorFamily.accent : colorFamily.border}
          emissive={selected ? colorFamily.accentMuted : colorFamily.bgMuted}
          emissiveIntensity={selected ? 1.5 : 1.0}
          clearcoat={1}
          clearcoatRoughness={0.15}
          roughness={0.25}
          metalness={0.15}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.3}>
        <icosahedronGeometry args={[0.65, 1]} />
        <meshBasicMaterial
          wireframe
          color={colorFamily.border}
          transparent
          opacity={selected ? 0.35 : 0.2}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.06}>
        <octahedronGeometry args={[0.65, 0]} />
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
