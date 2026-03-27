"use client";

import { useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import type { Line2 } from "three-stdlib";

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
  const lineRef = useRef<Line2 | null>(null);
  const baseOpacity = Math.max(0.45, Math.min(0.9, weight));
  const baseLineWidth = 1.5 + weight * 2;
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

    const material = lineRef.current?.material as
      | {
          opacity?: number;
          linewidth?: number;
          needsUpdate?: boolean;
        }
      | undefined;
    if (!material) {
      return;
    }

    if (typeof material.opacity === "number" && Math.abs(material.opacity - nextOpacity) >= 0.001) {
      material.opacity = nextOpacity;
      material.needsUpdate = true;
    }

    if (typeof material.linewidth === "number" && Math.abs(material.linewidth - nextLineWidth) >= 0.001) {
      material.linewidth = nextLineWidth;
      material.needsUpdate = true;
    }
  });

  return (
    <Line
      ref={lineRef}
      points={[from, to]}
      color={color}
      lineWidth={baseLineWidth}
      transparent
      opacity={0}
    />
  );
}
