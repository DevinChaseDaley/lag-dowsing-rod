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

export function computeRodAngleRadians(users: User[]): number {
  if (users.length === 0) return 0;

  const totalSlots = getTotalSlots(users);
  let x = 0;
  let y = 0;

  for (const user of users) {
    const weight = user.ping ?? 0;
    if (weight <= 0) continue;

    const angle = wheelAngleRadians(user.slotIndex, totalSlots);
    x += weight * Math.cos(angle);
    y += weight * Math.sin(angle);
  }

  if (x === 0 && y === 0) return 0;
  return Math.atan2(y, x);
}

export function computeRodAngleDegrees(users: User[]): number {
  return (computeRodAngleRadians(users) * 180) / Math.PI;
}

export function rollingAverage(samples: number[], size: number): number | null {
  if (samples.length === 0) return null;
  const recent = samples.slice(-size);
  return recent.reduce((sum, value) => sum + value, 0) / recent.length;
}
