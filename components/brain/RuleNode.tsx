"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

interface RuleNodeProps {
  position: [number, number, number];
  selected: boolean;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

export function RuleNode({ position, selected, onHover, onClick }: RuleNodeProps) {
  const groupRef = useRef<Group>(null);
  const spawnProgressRef = useRef(0);
  const baseScale = selected ? 1.25 : 1;

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
        <icosahedronGeometry args={[0.42, 1]} />
        <meshPhysicalMaterial
          color={selected ? "#fcd34d" : "#f59e0b"}
          emissive={selected ? "#b45309" : "#92400e"}
          emissiveIntensity={selected ? 1.2 : 0.8}
          clearcoat={1}
          clearcoatRoughness={0.15}
          roughness={0.25}
          metalness={0.15}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.06}>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshBasicMaterial
          color={selected ? "#fcd34d" : "#f59e0b"}
          transparent
          opacity={selected ? 0.08 : 0.06}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
