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
    expect(wheelAngleRadians(0, 4)).toBeCloseTo(-Math.PI / 2);
  });
});

describe("getTotalSlots", () => {
  it("accounts for gaps when users leave", () => {
    expect(getTotalSlots([user(0, 10), user(2, 20)])).toBe(3);
  });
});

describe("computeRodAngleRadians", () => {
  it("returns 0 with no users", () => {
    expect(computeRodAngleRadians([])).toBe(0);
  });

  it("points at the single user", () => {
    const users = [user(0, 100)];
    expect(computeRodAngleRadians(users)).toBeCloseTo(wheelAngleRadians(0, 1));
  });

  it("points between opposite users with equal ping", () => {
    const users = [user(0, 100), user(1, 100)];
    const angle = computeRodAngleRadians(users);
    expect(Math.cos(angle)).toBeCloseTo(0, 1);
  });

  it("pulls toward the higher ping user", () => {
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
    const users = [user(0, null), user(1, 100)];
    expect(computeRodAngleRadians(users)).toBeCloseTo(wheelAngleRadians(1, 2));
  });
});

describe("computeRodAngleDegrees", () => {
  it("converts radians to degrees", () => {
    expect(computeRodAngleDegrees([user(0, 100)])).toBeCloseTo(-90);
  });
});

describe("rollingAverage", () => {
  it("returns null for empty samples", () => {
    expect(rollingAverage([], 5)).toBeNull();
  });

  it("averages the most recent samples", () => {
    expect(rollingAverage([10, 20, 30, 40, 50, 60], 3)).toBe(50);
  });
});
