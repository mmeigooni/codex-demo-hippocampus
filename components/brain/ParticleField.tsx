"use client";

import { Sparkles } from "@react-three/drei";

export function ParticleField() {
  return (
    <Sparkles
      count={120}
      scale={14}
      size={2}
      speed={0.25}
      opacity={0.45}
      color="#7dd3fc"
      noise={0.5}
    />
  );
}
