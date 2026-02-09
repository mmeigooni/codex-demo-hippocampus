"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, MeshPhysicalMaterial } from "three";

import type { PatternKey } from "@/lib/memory/pattern-taxonomy";
import { getColorFamilyForPatternKey } from "@/lib/color/cluster-palette";

interface RuleNodeProps {
  patternKey: string;
  position: [number, number, number];
  selected: boolean;
  burstActive?: boolean;
  burstEpoch?: number;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

function elasticEaseOut(t: number) {
  const p = 0.3;
  return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
}

export function RuleNode({
  patternKey,
  position,
  selected,
  burstActive,
  burstEpoch,
  onHover,
  onClick,
}: RuleNodeProps) {
  const groupRef = useRef<Group>(null);
  const coreMaterialRef = useRef<MeshPhysicalMaterial>(null);
  const spawnProgressRef = useRef(0);
  const burstProgressRef = useRef(0);
  const lastBurstEpochRef = useRef(-1);

  const baseScale = selected ? 1.25 : 1;
  const baseEmissiveIntensity = selected ? 2.1 : 1.6;
  const colorFamily = getColorFamilyForPatternKey(patternKey as PatternKey);
  const coreRadius = 0.21;
  const latticeRadius = 0.28;

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    let burstScaleMultiplier = 1;
    let emissiveIntensity = baseEmissiveIntensity;

    if (burstProgressRef.current > 0 && burstProgressRef.current < 1) {
      burstProgressRef.current = Math.min(1, burstProgressRef.current + delta / 0.8);
      const eased = elasticEaseOut(burstProgressRef.current);
      burstScaleMultiplier = 2 - eased;
      emissiveIntensity = 3.5 + (baseEmissiveIntensity - 3.5) * burstProgressRef.current;

      if (burstProgressRef.current >= 1) {
        burstProgressRef.current = 0;
        burstScaleMultiplier = 1;
        emissiveIntensity = baseEmissiveIntensity;
      }
    }

    if (spawnProgressRef.current < 1) {
      spawnProgressRef.current = Math.min(1, spawnProgressRef.current + delta * 3.5);
      const eased = 1 - Math.pow(1 - spawnProgressRef.current, 3);
      group.scale.setScalar(eased * baseScale * burstScaleMultiplier);
    } else {
      group.scale.setScalar(baseScale * burstScaleMultiplier);
    }

    group.rotation.y += delta * 0.3;

    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissiveIntensity = emissiveIntensity;
    }
  });

  useEffect(() => {
    if (burstActive && burstEpoch !== undefined && burstEpoch !== lastBurstEpochRef.current) {
      burstProgressRef.current = 0.001;
      lastBurstEpochRef.current = burstEpoch;
    }
  }, [burstActive, burstEpoch]);

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }

    if (spawnProgressRef.current >= 1 && burstProgressRef.current === 0) {
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
          ref={coreMaterialRef}
          color={selected ? colorFamily.accent : colorFamily.border}
          emissive={selected ? colorFamily.accent : colorFamily.border}
          emissiveIntensity={baseEmissiveIntensity}
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
      <mesh scale={1.04}>
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
