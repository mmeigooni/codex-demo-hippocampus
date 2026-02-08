"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

interface RuleNodeProps {
  position: [number, number, number];
  selected: boolean;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

export function RuleNode({ position, selected, onHover, onClick }: RuleNodeProps) {
  const meshRef = useRef<Mesh>(null);
  const spawnProgressRef = useRef(0);
  const baseScale = selected ? 1.2 : 1;

  useFrame((_, delta) => {
    if (!meshRef.current) {
      return;
    }

    if (spawnProgressRef.current >= 1) {
      return;
    }

    spawnProgressRef.current = Math.min(1, spawnProgressRef.current + delta * 3.5);
    const eased = 1 - Math.pow(1 - spawnProgressRef.current, 3);
    meshRef.current.scale.setScalar(eased * baseScale);
  });

  useEffect(() => {
    if (!meshRef.current) {
      return;
    }

    if (spawnProgressRef.current >= 1) {
      meshRef.current.scale.setScalar(baseScale);
    }
  }, [baseScale]);

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={() => onHover(true)}
      onPointerOut={() => onHover(false)}
      onClick={onClick}
    >
      <icosahedronGeometry args={[0.42, 0]} />
      <meshStandardMaterial
        color={selected ? "#fcd34d" : "#f59e0b"}
        emissive={selected ? "#b45309" : "#92400e"}
        emissiveIntensity={selected ? 1.2 : 0.8}
        toneMapped={false}
      />
    </mesh>
  );
}
