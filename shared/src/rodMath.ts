import type { PingMatrix, User } from "./types.js";

export function getTotalSlots(users: User[]): number {
  if (users.length === 0) return 0;
  return Math.max(...users.map((user) => user.slotIndex)) + 1;
}

export function wheelAngleRadians(slotIndex: number, totalSlots: number): number {
  if (totalSlots === 0) return 0;
  return (2 * Math.PI * slotIndex) / totalSlots - Math.PI / 2;
}

export function wheelPosition(
  slotIndex: number,
  totalSlots: number,
  radius: number,
): { x: number; y: number } {
  const angle = wheelAngleRadians(slotIndex, totalSlots);
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
  };
}

/**
 * The measured round-trip latency between two participants, read directly
 * from real WebRTC peer-to-peer measurements. Each side measures and
 * reports independently, so when both directions are known they're
 * averaged; when only one side has reported yet, that reading is used.
 * Returns null until at least one side has measured this pair.
 */
export function getPeerPing(pingMatrix: PingMatrix, a: string, b: string): number | null {
  if (a === b) return 0;

  const aToB = pingMatrix[a]?.[b];
  const bToA = pingMatrix[b]?.[a];

  if (aToB !== undefined && bToA !== undefined) return (aToB + bToA) / 2;
  if (aToB !== undefined) return aToB;
  if (bToA !== undefined) return bToA;
  return null;
}

/**
 * The total measured latency everyone else would experience connecting
 * directly to `user` if they hosted the session. Null until every other
 * participant's peer-to-peer connection to `user` has reported a measurement.
 */
export function computeCombinedPing(user: User, users: User[], pingMatrix: PingMatrix): number | null {
  const others = users.filter((other) => other.userId !== user.userId);
  if (others.length === 0) return 0;

  let total = 0;
  for (const other of others) {
    const pairPing = getPeerPing(pingMatrix, user.userId, other.userId);
    if (pairPing === null) return null;
    total += pairPing;
  }
  return total;
}

/**
 * The participant who would produce the lowest combined ping for the group
 * if they hosted. Falls back to the first slot when no peer-to-peer
 * measurements have come in yet, so the rod always has somewhere to point.
 */
export function findBestHost(users: User[], pingMatrix: PingMatrix): User | null {
  if (users.length === 0) return null;

  const candidates = users
    .map((user) => ({ user, combinedPing: computeCombinedPing(user, users, pingMatrix) }))
    .filter((entry): entry is { user: User; combinedPing: number } => entry.combinedPing !== null);

  if (candidates.length === 0) return users[0];

  return candidates.reduce((best, candidate) => {
    if (candidate.combinedPing < best.combinedPing) return candidate;
    if (candidate.combinedPing === best.combinedPing && candidate.user.slotIndex < best.user.slotIndex) {
      return candidate;
    }
    return best;
  }).user;
}

export function computeRodAngleRadians(users: User[], pingMatrix: PingMatrix): number {
  if (users.length === 0) return 0;

  const bestHost = findBestHost(users, pingMatrix);
  if (!bestHost) return 0;

  const totalSlots = getTotalSlots(users);
  return wheelAngleRadians(bestHost.slotIndex, totalSlots);
}

export function computeRodAngleDegrees(users: User[], pingMatrix: PingMatrix): number {
  return (computeRodAngleRadians(users, pingMatrix) * 180) / Math.PI;
}

export function rollingAverage(samples: number[], size: number): number | null {
  if (samples.length === 0) return null;
  const recent = samples.slice(-size);
  return recent.reduce((sum, value) => sum + value, 0) / recent.length;
}
