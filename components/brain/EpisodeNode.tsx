"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";

import type { PatternKey } from "@/lib/memory/pattern-taxonomy";
import { getColorFamilyForPatternKey } from "@/lib/color/cluster-palette";
import { createFracturedIcosahedron } from "@/components/brain/geometry/fractured-icosahedron";

type ActivationMode = "pulse" | "flash-warn" | "salience-shift";

interface EpisodeNodeProps {
  nodeId: string;
  patternKey: string;
  position: [number, number, number];
  salience: number;
  selected: boolean;
  activationMode?: ActivationMode | null;
  activationEpoch?: number;
  pulsing?: boolean;
  pulseEpoch?: number;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

export function EpisodeNode({
  nodeId,
  patternKey,
  position,
  salience,
  selected,
  activationMode,
  activationEpoch,
  pulsing,
  pulseEpoch,
  onHover,
  onClick,
}: EpisodeNodeProps) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const latticeMaterialRef = useRef<MeshBasicMaterial>(null);
  const rippleRingRef = useRef<Mesh>(null);
  const rippleMaterialRef = useRef<MeshBasicMaterial>(null);
  const originalPositionsRef = useRef<Float32Array | null>(null);

  const spawnProgressRef = useRef(0);
  const pulseProgressRef = useRef(0);
  const flashProgressRef = useRef(0);
  const salienceProgressRef = useRef(0);
  const rippleProgressRef = useRef(0);

  const lastPulseEpochRef = useRef(-1);
  const lastFlashEpochRef = useRef(-1);
  const lastSalienceEpochRef = useRef(-1);
  const salienceStartOpacityRef = useRef(0);
  const baseLatticeColorRef = useRef("");

  const radius = 0.21;
  const baseScale = selected ? 1.25 : 1;
  const colorFamily = getColorFamilyForPatternKey(patternKey as PatternKey);
  const normalizedSalience = Math.max(0, Math.min(10, salience));
  const latticeOpacity = 0.2 + (normalizedSalience / 10) * 0.18;
  const baseLatticeOpacity = selected ? Math.min(0.55, latticeOpacity + 0.09) : latticeOpacity;
  const baseLatticeColor = selected ? colorFamily.accent : colorFamily.border;
  const removalFraction = 0.45 - (normalizedSalience / 10) * 0.25;
  const fracturedGeo = useMemo(
    () => createFracturedIcosahedron(radius, 1, nodeId, removalFraction),
    [nodeId, radius, removalFraction],
  );

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    let pulseIntensity = 0;
    let latticeOpacityValue = baseLatticeOpacity;
    let shakeOffsetX = 0;

    if (spawnProgressRef.current < 1) {
      spawnProgressRef.current = Math.min(1, spawnProgressRef.current + delta * 3.5);
      const eased = 1 - Math.pow(1 - spawnProgressRef.current, 3);
      group.scale.setScalar(eased * baseScale);
    }

    if (pulseProgressRef.current > 0 && pulseProgressRef.current < 1) {
      pulseProgressRef.current = Math.min(1, pulseProgressRef.current + delta / 1.5);
      const pulseScale = Math.sin(pulseProgressRef.current * Math.PI);
      pulseIntensity = pulseScale * 1.0;
      group.scale.setScalar(baseScale * (1 + pulseScale * 0.15));
    } else if (pulseProgressRef.current >= 1) {
      pulseProgressRef.current = 0;
      if (spawnProgressRef.current >= 1) {
        group.scale.setScalar(baseScale);
      }
    }

    if (flashProgressRef.current > 0 && flashProgressRef.current < 1) {
      flashProgressRef.current = Math.min(1, flashProgressRef.current + delta / 0.6);
      shakeOffsetX = Math.sin(flashProgressRef.current * Math.PI * 6) * 0.08;

      if (latticeMaterialRef.current) {
        latticeMaterialRef.current.color.set("#ff6b35");
      }

      if (flashProgressRef.current >= 1) {
        flashProgressRef.current = 0;
        if (latticeMaterialRef.current) {
          latticeMaterialRef.current.color.set(baseLatticeColorRef.current);
        }
      }
    }

    if (salienceProgressRef.current > 0 && salienceProgressRef.current < 1) {
      salienceProgressRef.current = Math.min(1, salienceProgressRef.current + delta / 0.8);
      const t = salienceProgressRef.current;
      const lerpedBase = salienceStartOpacityRef.current + (baseLatticeOpacity - salienceStartOpacityRef.current) * t;
      latticeOpacityValue = Math.min(0.6, lerpedBase * (1 + 0.15 * Math.sin(t * Math.PI)));

      if (salienceProgressRef.current >= 1) {
        salienceProgressRef.current = 0;
        latticeOpacityValue = baseLatticeOpacity;
      }
    }

    if (rippleProgressRef.current > 0 && rippleProgressRef.current < 1) {
      rippleProgressRef.current = Math.min(1, rippleProgressRef.current + delta / 0.8);
      const t = rippleProgressRef.current;

      if (rippleRingRef.current) {
        rippleRingRef.current.visible = true;
        rippleRingRef.current.scale.setScalar(Math.max(0.001, 1.5 * t));
      }

      if (rippleMaterialRef.current) {
        rippleMaterialRef.current.opacity = Math.max(0, 0.5 * (1 - t));
      }

      if (rippleProgressRef.current >= 1) {
        rippleProgressRef.current = 0;
        if (rippleRingRef.current) {
          rippleRingRef.current.visible = false;
          rippleRingRef.current.scale.setScalar(0.001);
        }
        if (rippleMaterialRef.current) {
          rippleMaterialRef.current.opacity = 0;
        }
      }
    }

    group.position.set(position[0] + shakeOffsetX, position[1], position[2]);

    if (latticeMaterialRef.current) {
      latticeMaterialRef.current.opacity = Math.min(0.6, latticeOpacityValue + pulseIntensity * 0.08);
    }

    const mesh = meshRef.current;
    if (mesh) {
      const positionAttribute = mesh.geometry.getAttribute("position");

      if (
        !originalPositionsRef.current ||
        originalPositionsRef.current.length !== positionAttribute.array.length
      ) {
        originalPositionsRef.current = new Float32Array(positionAttribute.array);
      }

      const original = originalPositionsRef.current;
      if (!original) {
        return;
      }

      const time = state.clock.elapsedTime;
      const noiseAmp = 0.008 + pulseIntensity * 0.012;

      for (let i = 0; i < positionAttribute.count; i += 1) {
        const phase = i * 0.7;
        positionAttribute.setXYZ(
          i,
          original[i * 3] + Math.sin(time * 1.2 + phase) * noiseAmp,
          original[i * 3 + 1] + Math.sin(time * 0.9 + phase * 1.3) * noiseAmp * 0.7,
          original[i * 3 + 2] + Math.sin(time * 1.1 + phase * 0.8) * noiseAmp * 0.9,
        );
      }

      positionAttribute.needsUpdate = true;
    }
  });

  useEffect(() => {
    baseLatticeColorRef.current = baseLatticeColor;

    if (flashProgressRef.current === 0 && latticeMaterialRef.current) {
      latticeMaterialRef.current.color.set(baseLatticeColor);
    }
  }, [baseLatticeColor]);

  useEffect(() => {
    if (rippleRingRef.current) {
      rippleRingRef.current.visible = false;
      rippleRingRef.current.scale.setScalar(0.001);
    }
  }, []);

  useEffect(() => {
    return () => {
      fracturedGeo.dispose();
      originalPositionsRef.current = null;
    };
  }, [fracturedGeo]);

  useEffect(() => {
    const shouldUseLegacyPulse = activationMode === undefined || activationMode === null;
    const nextPulseEpoch = shouldUseLegacyPulse ? pulseEpoch : activationMode === "pulse" ? activationEpoch : undefined;
    const shouldTriggerPulse = shouldUseLegacyPulse ? pulsing : activationMode === "pulse";

    if (shouldTriggerPulse && nextPulseEpoch !== undefined && nextPulseEpoch !== lastPulseEpochRef.current) {
      pulseProgressRef.current = 0.001;
      lastPulseEpochRef.current = nextPulseEpoch;
    }
  }, [activationEpoch, activationMode, pulseEpoch, pulsing]);

  useEffect(() => {
    if (
      activationMode === "flash-warn" &&
      activationEpoch !== undefined &&
      activationEpoch !== lastFlashEpochRef.current
    ) {
      flashProgressRef.current = 0.001;
      lastFlashEpochRef.current = activationEpoch;
    }
  }, [activationEpoch, activationMode]);

  useEffect(() => {
    if (
      activationMode === "salience-shift" &&
      activationEpoch !== undefined &&
      activationEpoch !== lastSalienceEpochRef.current
    ) {
      salienceStartOpacityRef.current = latticeMaterialRef.current?.opacity ?? baseLatticeOpacity;
      salienceProgressRef.current = 0.001;
      rippleProgressRef.current = 0.001;
      lastSalienceEpochRef.current = activationEpoch;
    }
  }, [activationEpoch, activationMode, baseLatticeOpacity]);

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }

    if (spawnProgressRef.current >= 1 && pulseProgressRef.current === 0) {
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
      <mesh ref={meshRef} geometry={fracturedGeo}>
        <meshBasicMaterial
          ref={latticeMaterialRef}
          wireframe
          color={baseLatticeColor}
          transparent
          opacity={baseLatticeOpacity}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={rippleRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.22, 24]} />
        <meshBasicMaterial
          ref={rippleMaterialRef}
          color={colorFamily.accent}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
