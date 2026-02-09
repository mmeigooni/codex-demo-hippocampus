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
  const targetOpacity = Math.max(0.2, Math.min(0.85, weight));
  const [currentOpacity, setCurrentOpacity] = useState(0);
  const spawnProgressRef = useRef(0);

  useFrame((_, delta) => {
    if (spawnProgressRef.current >= 1) {
      return;
    }

    spawnProgressRef.current = Math.min(1, spawnProgressRef.current + delta / 0.3);
    const eased = 1 - Math.pow(1 - spawnProgressRef.current, 3);
    const nextOpacity = targetOpacity * eased;

    setCurrentOpacity((previous) => (Math.abs(previous - nextOpacity) < 0.001 ? previous : nextOpacity));
  });

  useEffect(() => {
    if (spawnProgressRef.current >= 1) {
      setCurrentOpacity(targetOpacity);
    }
  }, [targetOpacity]);

  return (
    <Line
      points={[from, to]}
      color={color}
      lineWidth={1 + weight * 1.5}
      transparent
      opacity={currentOpacity}
    />
  );
}
