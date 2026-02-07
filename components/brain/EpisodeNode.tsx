"use client";

interface EpisodeNodeProps {
  position: [number, number, number];
  salience: number;
  selected: boolean;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

export function EpisodeNode({ position, salience, selected, onHover, onClick }: EpisodeNodeProps) {
  const intensity = 0.35 + salience / 10;

  return (
    <mesh
      position={position}
      onPointerOver={() => onHover(true)}
      onPointerOut={() => onHover(false)}
      onClick={onClick}
      scale={selected ? 1.15 : 1}
    >
      <sphereGeometry args={[0.3 + salience * 0.015, 24, 24]} />
      <meshStandardMaterial
        color={selected ? "#67e8f9" : "#22d3ee"}
        emissive={selected ? "#0891b2" : "#164e63"}
        emissiveIntensity={selected ? intensity + 0.35 : intensity}
        toneMapped={false}
      />
    </mesh>
  );
}
