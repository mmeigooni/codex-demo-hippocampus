"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshBasicMaterial } from "three";

interface SynapticImpulseProps {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  durationMs: number;
  arcHeight?: number;
  onComplete?: () => void;
}

export function SynapticImpulse({
  from,
  to,
  color,
  durationMs,
  arcHeight = 0.5,
  onComplete,
}: SynapticImpulseProps) {
  const meshRef = useRef<Mesh>(null);
  const progressRef = useRef(0);
  const completedRef = useRef(false);

  const controlPoint = useMemo<[number, number, number]>(
    () => [
      (from[0] + to[0]) * 0.5,
      (from[1] + to[1]) * 0.5 + arcHeight,
      (from[2] + to[2]) * 0.5,
    ],
    [arcHeight, from, to],
  );

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const durationSeconds = Math.max(1, durationMs) / 1000;
    progressRef.current = Math.min(1, progressRef.current + delta / durationSeconds);

    const t = progressRef.current;
    const inv = 1 - t;

    const x = inv * inv * from[0] + 2 * inv * t * controlPoint[0] + t * t * to[0];
    const y = inv * inv * from[1] + 2 * inv * t * controlPoint[1] + t * t * to[1];
    const z = inv * inv * from[2] + 2 * inv * t * controlPoint[2] + t * t * to[2];
    mesh.position.set(x, y, z);

    const material = mesh.material as MeshBasicMaterial;
    const rawOpacity = t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1;
    material.opacity = Math.max(0, rawOpacity * 0.9);

    if (t >= 1 && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  });

  return (
    <mesh ref={meshRef} position={from}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}
