"use client";

interface RuleNodeProps {
  position: [number, number, number];
  selected: boolean;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

export function RuleNode({ position, selected, onHover, onClick }: RuleNodeProps) {
  return (
    <mesh
      position={position}
      onPointerOver={() => onHover(true)}
      onPointerOut={() => onHover(false)}
      onClick={onClick}
      scale={selected ? 1.2 : 1}
    >
      <icosahedronGeometry args={[0.42, 0]} />
      <meshStandardMaterial
        color={selected ? "#fcd34d" : "#f59e0b"}
        emissive={selected ? "#b45309" : "#92400e"}
        emissiveIntensity={selected ? 1.2 : 0.8}
        toneMapped={false}
      />
    </mesh>
  );
}
