import { BufferGeometry, IcosahedronGeometry } from "three";

function hashSeed(str: string): number {
  let hash = 0;

  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;

  if (s <= 0) {
    s += 2147483646;
  }

  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createFracturedIcosahedron(
  radius: number,
  detail: number,
  nodeId: string,
  removalFraction = 0.35,
): BufferGeometry {
  const geometry = new IcosahedronGeometry(radius, detail);
  const index = geometry.getIndex();

  if (!index) {
    return geometry;
  }

  const rngSeed = hashSeed(nodeId) || 1;
  const rng = seededRandom(rngSeed);
  const sourceIndices = index.array;
  const newIndices: number[] = [];
  const faceCount = Math.floor(sourceIndices.length / 3);
  const clampedRemovalFraction = Math.min(1, Math.max(0, removalFraction));

  for (let face = 0; face < faceCount; face += 1) {
    if (rng() > clampedRemovalFraction) {
      const offset = face * 3;
      newIndices.push(
        sourceIndices[offset] as number,
        sourceIndices[offset + 1] as number,
        sourceIndices[offset + 2] as number,
      );
    }
  }

  geometry.setIndex(newIndices);

  return geometry;
}
