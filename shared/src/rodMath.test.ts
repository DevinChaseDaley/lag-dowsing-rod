import { describe, expect, it } from "vitest";
import {
  computeCombinedPing,
  computeRodAngleDegrees,
  computeRodAngleRadians,
  findBestHost,
  getPeerPing,
  getTotalSlots,
  rollingAverage,
  wheelAngleRadians,
} from "./rodMath.js";
import type { PingMatrix, User } from "./types.js";

function user(slotIndex: number, ping: number | null = null): User {
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
    expect(getTotalSlots([user(0), user(2)])).toBe(3);
  });
});

describe("getPeerPing", () => {
  it("is zero for a user against themself", () => {
    // Input: the same userId on both sides.
    // Output: no peer-to-peer hop is needed, so it's zero.
    expect(getPeerPing({}, "u0", "u0")).toBe(0);
  });

  it("averages both directions when both sides have measured", () => {
    // Input: a matrix where each side independently measured the same pair.
    // Output: the pairwise ping is the average of both measurements.
    const matrix: PingMatrix = { u0: { u1: 20 }, u1: { u0: 30 } };
    expect(getPeerPing(matrix, "u0", "u1")).toBe(25);
  });

  it("falls back to whichever side has reported", () => {
    // Input: only one side of the pair has a measurement so far.
    // Output: that single reading is used directly.
    const matrix: PingMatrix = { u0: { u1: 40 } };
    expect(getPeerPing(matrix, "u0", "u1")).toBe(40);
    expect(getPeerPing(matrix, "u1", "u0")).toBe(40);
  });

  it("returns null when neither side has measured the pair", () => {
    // Input: an empty matrix.
    // Output: the pairwise ping is unknown, not a guess.
    expect(getPeerPing({}, "u0", "u1")).toBeNull();
  });
});

describe("computeCombinedPing", () => {
  it("is zero for a lone participant", () => {
    // Input: a single user with no one else in the session.
    // Output: there's no one to connect to, so combined ping is zero.
    const solo = user(0);
    expect(computeCombinedPing(solo, [solo], {})).toBe(0);
  });

  it("sums measured peer-to-peer ping to every other participant", () => {
    // Input: three users with a fully populated ping matrix.
    // Output: user 0's combined ping is the sum of its measured pairwise
    // latency to user 1 and user 2.
    const users = [user(0), user(1), user(2)];
    const matrix: PingMatrix = {
      u0: { u1: 20, u2: 40 },
      u1: { u0: 20 },
      u2: { u0: 40 },
    };
    expect(computeCombinedPing(users[0], users, matrix)).toBe(60);
  });

  it("is null until every peer connection has reported", () => {
    // Input: a candidate with a measurement to one peer but not the other.
    // Output: the combined ping can't be computed yet.
    const users = [user(0), user(1), user(2)];
    const matrix: PingMatrix = { u0: { u1: 20 } };
    expect(computeCombinedPing(users[0], users, matrix)).toBeNull();
  });
});

describe("findBestHost", () => {
  it("returns null for an empty session", () => {
    // Input: no participants.
    // Output: there's no one to recommend as host.
    expect(findBestHost([], {})).toBeNull();
  });

  it("picks the only participant when alone", () => {
    // Input: a single participant.
    // Output: they're the only possible host.
    const solo = user(0);
    expect(findBestHost([solo], {})).toBe(solo);
  });

  it("picks the participant with the lowest combined ping", () => {
    // Input: one well-connected user and two laggier users, per the
    // measured peer-to-peer matrix.
    // Output: the well-connected user produces the lowest combined ping
    // for the group and should be recommended as host.
    const central = user(0);
    const laggy1 = user(1);
    const laggy2 = user(2);
    const matrix: PingMatrix = {
      u0: { u1: 15, u2: 20 },
      u1: { u0: 15, u2: 180 },
      u2: { u0: 20, u1: 180 },
    };
    expect(findBestHost([central, laggy1, laggy2], matrix)).toBe(central);
  });

  it("falls back to the first slot when no measurements have come in yet", () => {
    // Input: a session where no peer-to-peer connection has reported yet.
    // Output: the rod still has somewhere to point.
    const users = [user(0), user(1)];
    expect(findBestHost(users, {})).toBe(users[0]);
  });
});

describe("computeRodAngleRadians", () => {
  it("returns 0 with no users", () => {
    // Input: an empty user list.
    // Output: the rod angle should default to zero.
    expect(computeRodAngleRadians([], {})).toBe(0);
  });

  it("points at the single user", () => {
    // Input: one user.
    // Output: the rod should point directly at that user's wheel position.
    const users = [user(0)];
    expect(computeRodAngleRadians(users, {})).toBeCloseTo(wheelAngleRadians(0, 1));
  });

  it("points at whichever user gives the lowest combined ping", () => {
    // Input: a well-connected user and a laggier user in opposite slots.
    // Output: the rod should point at the well-connected (better host)
    // user's slot, not the laggy one.
    const central = user(0);
    const laggy = user(1);
    const matrix: PingMatrix = { u0: { u1: 20 }, u1: { u0: 200 } };
    const angle = computeRodAngleRadians([central, laggy], matrix);
    expect(angle).toBeCloseTo(wheelAngleRadians(0, 2));
  });
});

describe("computeRodAngleDegrees", () => {
  it("converts radians to degrees", () => {
    // Input: a rod angle in radians.
    // Output: the helper should convert it to degrees correctly.
    expect(computeRodAngleDegrees([user(0)], {})).toBeCloseTo(-90);
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
