const BASE_STAGGER_SECONDS = 0.06;
const MAX_JITTER_MS = 80;

function hashString(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }

  return hash;
}

export function entryDelay(eventId: string, index: number): number {
  const safeIndex = Number.isFinite(index) && index > 0 ? index : 0;
  const jitterMs = Math.abs(hashString(eventId)) % (MAX_JITTER_MS + 1);
  return safeIndex * BASE_STAGGER_SECONDS + jitterMs / 1000;
}
