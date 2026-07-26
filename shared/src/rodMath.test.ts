import { describe, expect, it } from "vitest";
import {
  computeRodAngleDegrees,
  computeRodAngleRadians,
  getTotalSlots,
  rollingAverage,
  wheelAngleRadians,
} from "./rodMath.js";
import type { User } from "./types.js";

function user(slotIndex: number, ping: number | null): User {
  return {
    userId: `u${slotIndex}`,
    userName: `User ${slotIndex}`,
    slotIndex,
    ping,
    clientId: `c${slotIndex}`,
  };
}

describe("wheelAngleRadians", () => {
  it("starts at top for slot 0", () => {
    // Input: the first slot on a four-slot wheel.
    // Output: the angle should point straight up at the top.
    expect(wheelAngleRadians(0, 4)).toBeCloseTo(-Math.PI / 2);
  });
});

describe("getTotalSlots", () => {
  it("accounts for gaps when users leave", () => {
    // Input: two users occupying slots 0 and 2 after one slot is empty.
    // Output: the total number of slots should still include the empty slot.
    expect(getTotalSlots([user(0, 10), user(2, 20)])).toBe(3);
  });
});

describe("computeRodAngleRadians", () => {
  it("returns 0 with no users", () => {
    // Input: an empty user list.
    // Output: the rod angle should default to zero.
    expect(computeRodAngleRadians([])).toBe(0);
  });

  it("points at the single user", () => {
    // Input: one user with a strong ping.
    // Output: the rod should point directly at that user’s wheel position.
    const users = [user(0, 100)];
    expect(computeRodAngleRadians(users)).toBeCloseTo(wheelAngleRadians(0, 1));
  });

  it("points between opposite users with equal ping", () => {
    // Input: two users with equal ping occupying opposite slots.
    // Output: the rod should settle halfway between them, which yields a cosine near zero.
    const users = [user(0, 100), user(1, 100)];
    const angle = computeRodAngleRadians(users);
    expect(Math.cos(angle)).toBeCloseTo(0, 1);
  });

  it("pulls toward the higher ping user", () => {
    // Input: one low-ping user and one high-ping user.
    // Output: the rod should lean more toward the higher-ping user.
    const low = user(0, 20);
    const high = user(1, 200);
    const angle = computeRodAngleRadians([low, high]);
    const highAngle = wheelAngleRadians(high.slotIndex, 2);
    const lowAngle = wheelAngleRadians(low.slotIndex, 2);

    const distToHigh = Math.abs(Math.atan2(Math.sin(angle - highAngle), Math.cos(angle - highAngle)));
    const distToLow = Math.abs(Math.atan2(Math.sin(angle - lowAngle), Math.cos(angle - lowAngle)));
    expect(distToHigh).toBeLessThan(distToLow);
  });

  it("ignores users without ping samples", () => {
    // Input: one user with no ping sample and one user with a valid ping.
    // Output: only the valid ping should influence the rod angle.
    const users = [user(0, null), user(1, 100)];
    expect(computeRodAngleRadians(users)).toBeCloseTo(wheelAngleRadians(1, 2));
  });
});

describe("computeRodAngleDegrees", () => {
  it("converts radians to degrees", () => {
    // Input: a rod angle in radians.
    // Output: the helper should convert it to degrees correctly.
    expect(computeRodAngleDegrees([user(0, 100)])).toBeCloseTo(-90);
  });
});

describe("rollingAverage", () => {
  it("returns null for empty samples", () => {
    // Input: an empty sample list.
    // Output: the helper should return null.
    expect(rollingAverage([], 5)).toBeNull();
  });

  it("averages the most recent samples", () => {
    // Input: a longer sample list and a window size of three.
    // Output: the average of the last three values should be returned.
    expect(rollingAverage([10, 20, 30, 40, 50, 60], 3)).toBe(50);
  });
});
