"use client";

import { useMemo } from "react";

import { Sparkles } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { AdditiveBlending } from "three";

const PARTICLE_COUNT = 120;

interface ParticleFieldProps {
  isConsolidating?: boolean;
}

export function ParticleField({ isConsolidating = false }: ParticleFieldProps) {
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const sizes = useMemo(
    () =>
      Float32Array.from({ length: PARTICLE_COUNT }, (_, index) => {
        const pseudoRandom = Math.abs(Math.sin((index + 1) * 12.9898) * 43758.5453) % 1;
        return 0.2 + pseudoRandom * 0.28;
      }),
    [],
  );

  return (
    <group position={[0, 0, -1.4]}>
      <Sparkles
        count={PARTICLE_COUNT}
        scale={[11, 8, 11]}
        size={sizes}
        speed={isConsolidating ? 0.04 : 0.08}
        opacity={isConsolidating ? 0.45 : 0.34}
        color="#7dd3fc"
        noise={0.2}
      >
        <sparklesImplMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          pixelRatio={pixelRatio}
        />
      </Sparkles>
    </group>
  );
}
