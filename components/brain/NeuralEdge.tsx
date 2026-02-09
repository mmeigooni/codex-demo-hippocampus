"use client";

import { useEffect, useRef, useState } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

interface NeuralEdgeProps {
  from: [number, number, number];
  to: [number, number, number];
  weight: number;
  color?: string;
}

export function NeuralEdge({ from, to, weight, color = "#38bdf8" }: NeuralEdgeProps) {
  const targetOpacity = Math.max(0.45, Math.min(0.9, weight));
  const [currentOpacity, setCurrentOpacity] = useState(0);
  const spawnProgressRef = useRef(0);
  const spawnGlowRef = useRef(1);

  useFrame((_, delta) => {
    if (spawnProgressRef.current >= 1 && spawnGlowRef.current <= 0) {
      return;
    }

    if (spawnProgressRef.current < 1) {
      spawnProgressRef.current = Math.min(1, spawnProgressRef.current + delta / 0.3);
    }

    const eased = 1 - Math.pow(1 - spawnProgressRef.current, 3);

    if (spawnGlowRef.current > 0) {
      spawnGlowRef.current = Math.max(0, spawnGlowRef.current - delta / 1.5);
    }

    const glowBoost = spawnGlowRef.current > 0 ? spawnGlowRef.current * 0.15 : 0;
    const nextOpacity = (targetOpacity + glowBoost) * eased;

    setCurrentOpacity((previous) => (Math.abs(previous - nextOpacity) < 0.001 ? previous : nextOpacity));
  });

  useEffect(() => {
    if (spawnProgressRef.current >= 1 && spawnGlowRef.current <= 0) {
      setCurrentOpacity(targetOpacity);
    }
  }, [targetOpacity]);

  return (
    <Line
      points={[from, to]}
      color={color}
      lineWidth={1.5 + weight * 2}
      transparent
      opacity={currentOpacity}
    />
  );
}
