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
  const latticeRadius = 0.42;
  const coreRadius = latticeRadius * 0.5;

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
        <sphereGeometry args={[coreRadius, 20, 20]} />
        <meshPhysicalMaterial
          color={selected ? colorFamily.accent : colorFamily.border}
          emissive={selected ? colorFamily.accent : colorFamily.border}
          emissiveIntensity={selected ? 2.1 : 1.6}
          clearcoat={1}
          clearcoatRoughness={0.2}
          roughness={0.35}
          metalness={0.05}
          transparent
          opacity={0.95}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[latticeRadius, 1]} />
        <meshBasicMaterial
          wireframe
          color={selected ? colorFamily.accent : colorFamily.border}
          transparent
          opacity={selected ? 0.48 : 0.34}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.12}>
        <icosahedronGeometry args={[latticeRadius, 1]} />
        <meshBasicMaterial
          color={selected ? colorFamily.accent : colorFamily.border}
          wireframe
          transparent
          opacity={selected ? 0.2 : 0.12}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
