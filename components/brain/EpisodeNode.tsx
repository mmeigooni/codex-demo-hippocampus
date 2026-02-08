"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

interface EpisodeNodeProps {
  position: [number, number, number];
  salience: number;
  selected: boolean;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

export function EpisodeNode({ position, salience, selected, onHover, onClick }: EpisodeNodeProps) {
  const meshRef = useRef<Mesh>(null);
  const spawnProgressRef = useRef(0);
  const intensity = 0.35 + salience / 10;
  const baseScale = selected ? 1.15 : 1;

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
      <sphereGeometry args={[0.3 + salience * 0.015, 24, 24]} />
      <meshStandardMaterial
        color={selected ? "#67e8f9" : "#22d3ee"}
        emissive={selected ? "#0891b2" : "#164e63"}
        emissiveIntensity={selected ? intensity + 0.35 : intensity}
        toneMapped={false}
      />
    </mesh>
  );
}
