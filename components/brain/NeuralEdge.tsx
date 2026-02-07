"use client";

import { Line } from "@react-three/drei";

interface NeuralEdgeProps {
  from: [number, number, number];
  to: [number, number, number];
  weight: number;
}

export function NeuralEdge({ from, to, weight }: NeuralEdgeProps) {
  const opacity = Math.max(0.2, Math.min(0.85, weight));

  return (
    <Line
      points={[from, to]}
      color="#38bdf8"
      lineWidth={1 + weight * 1.5}
      transparent
      opacity={opacity}
    />
  );
}
