import {
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
} from "three";

interface FracturedPrismGeometry {
  solidGeometry: BufferGeometry;
  edgeGeometry: BufferGeometry;
  pointGeometry: BufferGeometry;
}

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

function normalizeAngle(angle: number): number {
  const fullTurn = Math.PI * 2;
  let normalized = angle % fullTurn;

  if (normalized < 0) {
    normalized += fullTurn;
  }

  return normalized;
}

function isWithinArc(angle: number, start: number, span: number): boolean {
  const diff = normalizeAngle(angle - start);
  return diff <= span;
}

function createPointGeometryFromUsedVertices(geometry: BufferGeometry): BufferGeometry {
  const pointGeometry = new BufferGeometry();
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();

  if (!index) {
    pointGeometry.setAttribute("position", position.clone());
    return pointGeometry;
  }

  const used = new Set<number>();
  const sourceIndices = index.array;
  for (let i = 0; i < sourceIndices.length; i += 1) {
    used.add(sourceIndices[i] as number);
  }

  const ordered = Array.from(used).sort((a, b) => a - b);
  const points = new Float32Array(ordered.length * 3);
  const sourcePositions = position.array as ArrayLike<number>;

  for (let i = 0; i < ordered.length; i += 1) {
    const sourceOffset = ordered[i] * 3;
    const targetOffset = i * 3;
    points[targetOffset] = sourcePositions[sourceOffset];
    points[targetOffset + 1] = sourcePositions[sourceOffset + 1];
    points[targetOffset + 2] = sourcePositions[sourceOffset + 2];
  }

  pointGeometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  return pointGeometry;
}

export function createFracturedHexPrism(
  radius: number,
  height: number,
  nodeId: string,
  removalFraction: number,
): FracturedPrismGeometry {
  const solidGeometry = new CylinderGeometry(radius, radius, height, 6, 1, false);
  const index = solidGeometry.getIndex();

  if (!index) {
    const edgeGeometry = new EdgesGeometry(solidGeometry);
    const pointGeometry = createPointGeometryFromUsedVertices(solidGeometry);
    return { solidGeometry, edgeGeometry, pointGeometry };
  }

  const position = solidGeometry.getAttribute("position");
  const sourceIndices = index.array;
  const faceCount = Math.floor(sourceIndices.length / 3);
  const minFacesToKeep = Math.max(8, Math.floor(faceCount * 0.2));

  const clampedRemoval = Math.min(0.92, Math.max(0.1, removalFraction));
  const seed = hashSeed(nodeId) || 1;
  const random = seededRandom(seed);

  const primaryStart = random() * Math.PI * 2;
  const primarySpan = Math.min(
    Math.PI * 1.72,
    Math.max(Math.PI * 0.55, clampedRemoval * Math.PI * 2 * 0.9),
  );
  const hasSecondaryWedge = clampedRemoval > 0.45;
  const secondaryStart = hasSecondaryWedge
    ? normalizeAngle(primaryStart + Math.PI * (0.72 + random() * 0.45))
    : 0;
  const secondarySpan = hasSecondaryWedge
    ? Math.min(Math.PI * 0.72, primarySpan * (0.24 + random() * 0.16))
    : 0;

  let shrink = 1;
  let retainedIndices: number[] = [];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    retainedIndices = [];
    const trialPrimarySpan = primarySpan * shrink;
    const trialSecondarySpan = secondarySpan * shrink;

    for (let face = 0; face < faceCount; face += 1) {
      const offset = face * 3;
      const ia = sourceIndices[offset] as number;
      const ib = sourceIndices[offset + 1] as number;
      const ic = sourceIndices[offset + 2] as number;

      const ax = position.getX(ia);
      const az = position.getZ(ia);
      const bx = position.getX(ib);
      const bz = position.getZ(ib);
      const cx = position.getX(ic);
      const cz = position.getZ(ic);

      const centroidX = (ax + bx + cx) / 3;
      const centroidZ = (az + bz + cz) / 3;
      const centroidAngle = normalizeAngle(Math.atan2(centroidZ, centroidX));

      const inPrimaryWedge = isWithinArc(centroidAngle, primaryStart, trialPrimarySpan);
      const inSecondaryWedge = hasSecondaryWedge
        ? isWithinArc(centroidAngle, secondaryStart, trialSecondarySpan)
        : false;

      if (!inPrimaryWedge && !inSecondaryWedge) {
        retainedIndices.push(ia, ib, ic);
      }
    }

    if (retainedIndices.length / 3 >= minFacesToKeep) {
      break;
    }

    shrink *= 0.82;
  }

  if (retainedIndices.length / 3 < minFacesToKeep) {
    retainedIndices = Array.from(sourceIndices as ArrayLike<number>);
  }

  solidGeometry.setIndex(retainedIndices);
  solidGeometry.computeVertexNormals();

  const edgeGeometry = new EdgesGeometry(solidGeometry);
  const pointGeometry = createPointGeometryFromUsedVertices(solidGeometry);

  return { solidGeometry, edgeGeometry, pointGeometry };
}
