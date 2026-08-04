import type { User } from "./types.js";

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
 * Estimates the round-trip latency between two participants from their
 * individually measured pings to the shared session server, using the
 * server as a common reference point (sum of both legs). Returns null
 * when either side hasn't reported a ping yet.
 */
export function estimatePairwisePing(a: User, b: User): number | null {
  if (a.ping === null || b.ping === null) return null;
  return a.ping + b.ping;
}

/**
 * The total estimated latency everyone else would experience connecting to
 * `user` if they hosted the session. Null until every other participant has
 * a ping sample.
 */
export function computeCombinedPing(user: User, users: User[]): number | null {
  const others = users.filter((other) => other.userId !== user.userId);
  if (others.length === 0) return 0;
  if (user.ping === null) return null;

  let total = 0;
  for (const other of others) {
    const pairPing = estimatePairwisePing(user, other);
    if (pairPing === null) return null;
    total += pairPing;
  }
  return total;
}

/**
 * The participant who would produce the lowest combined ping for the group
 * if they hosted. Falls back to the first slot when no one has ping data
 * yet, so the rod always has somewhere to point.
 */
export function findBestHost(users: User[]): User | null {
  if (users.length === 0) return null;

  const candidates = users
    .map((user) => ({ user, combinedPing: computeCombinedPing(user, users) }))
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

export function computeRodAngleRadians(users: User[]): number {
  if (users.length === 0) return 0;

  const bestHost = findBestHost(users);
  if (!bestHost) return 0;

  const totalSlots = getTotalSlots(users);
  return wheelAngleRadians(bestHost.slotIndex, totalSlots);
}

export function computeRodAngleDegrees(users: User[]): number {
  return (computeRodAngleRadians(users) * 180) / Math.PI;
}

export function rollingAverage(samples: number[], size: number): number | null {
  if (samples.length === 0) return null;
  const recent = samples.slice(-size);
  return recent.reduce((sum, value) => sum + value, 0) / recent.length;
}
