"use client";

import { useEffect, useRef, useState } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";

interface NeuralEdgeProps {
  from: [number, number, number];
  to: [number, number, number];
  weight: number;
  color?: string;
  highlighted?: boolean;
}

export function NeuralEdge({
  from,
  to,
  weight,
  color = "#38bdf8",
  highlighted = false,
}: NeuralEdgeProps) {
  const baseOpacity = Math.max(0.45, Math.min(0.9, weight));
  const baseLineWidth = 1.5 + weight * 2;
  const [currentOpacity, setCurrentOpacity] = useState(0);
  const [currentLineWidth, setCurrentLineWidth] = useState(baseLineWidth);
  const spawnProgressRef = useRef(0);
  const spawnGlowRef = useRef(1);
  const highlightProgressRef = useRef(0);

  useFrame((_, delta) => {
    if (spawnProgressRef.current < 1) {
      spawnProgressRef.current = Math.min(1, spawnProgressRef.current + delta / 0.3);
    }

    const eased = 1 - Math.pow(1 - spawnProgressRef.current, 3);

    if (spawnGlowRef.current > 0) {
      spawnGlowRef.current = Math.max(0, spawnGlowRef.current - delta / 1.5);
    }

    highlightProgressRef.current = MathUtils.lerp(
      highlightProgressRef.current,
      highlighted ? 1 : 0,
      Math.min(1, delta * 4),
    );

    const glowBoost = spawnGlowRef.current > 0 ? spawnGlowRef.current * 0.15 : 0;
    const highlightBoost = highlightProgressRef.current;
    const nextOpacity = (baseOpacity + glowBoost + highlightBoost * 0.2) * eased;
    const nextLineWidth = baseLineWidth + highlightBoost * 1.5;

    setCurrentOpacity((previous) => (Math.abs(previous - nextOpacity) < 0.001 ? previous : nextOpacity));
    setCurrentLineWidth((previous) =>
      Math.abs(previous - nextLineWidth) < 0.001 ? previous : nextLineWidth,
    );
  });

  useEffect(() => {
    if (spawnProgressRef.current >= 1 && spawnGlowRef.current <= 0) {
      const targetHighlight = highlighted ? 1 : 0;
      setCurrentOpacity(baseOpacity + targetHighlight * 0.2);
      setCurrentLineWidth(baseLineWidth + targetHighlight * 1.5);
    }
  }, [baseLineWidth, baseOpacity, highlighted]);

  return (
    <Line
      points={[from, to]}
      color={color}
      lineWidth={currentLineWidth}
      transparent
      opacity={currentOpacity}
    />
  );
}
