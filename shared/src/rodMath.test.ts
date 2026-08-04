import { describe, expect, it } from "vitest";
import {
  computeCombinedPing,
  computeRodAngleDegrees,
  computeRodAngleRadians,
  estimatePairwisePing,
  findBestHost,
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

describe("estimatePairwisePing", () => {
  it("sums both legs through the shared server", () => {
    // Input: two users with known pings to the session server.
    // Output: their estimated pairwise ping is the sum of both legs.
    expect(estimatePairwisePing(user(0, 20), user(1, 30))).toBe(50);
  });

  it("returns null when either side lacks a ping sample", () => {
    // Input: one user with no ping sample yet.
    // Output: the pair estimate is unknown, not a guess.
    expect(estimatePairwisePing(user(0, null), user(1, 30))).toBeNull();
  });
});

describe("computeCombinedPing", () => {
  it("is zero for a lone participant", () => {
    // Input: a single user with no one else in the session.
    // Output: there's no one to connect to, so combined ping is zero.
    expect(computeCombinedPing(user(0, 100), [user(0, 100)])).toBe(0);
  });

  it("sums estimated pairwise ping to every other participant", () => {
    // Input: three users with known pings.
    // Output: user 0's combined ping is the sum of its estimated pairwise
    // latency to user 1 and user 2.
    const users = [user(0, 10), user(1, 20), user(2, 30)];
    expect(computeCombinedPing(users[0], users)).toBe((10 + 20) + (10 + 30));
  });

  it("is null until the candidate and every peer have ping samples", () => {
    // Input: a candidate with a ping sample but one peer still measuring.
    // Output: the combined ping can't be computed yet.
    const users = [user(0, 10), user(1, null), user(2, 30)];
    expect(computeCombinedPing(users[0], users)).toBeNull();
  });
});

describe("findBestHost", () => {
  it("returns null for an empty session", () => {
    // Input: no participants.
    // Output: there's no one to recommend as host.
    expect(findBestHost([])).toBeNull();
  });

  it("picks the only participant when alone", () => {
    // Input: a single participant.
    // Output: they're the only possible host.
    const solo = user(0, 100);
    expect(findBestHost([solo])).toBe(solo);
  });

  it("picks the participant with the lowest combined ping", () => {
    // Input: one well-connected user and two laggier users.
    // Output: the well-connected user produces the lowest combined ping
    // for the group and should be recommended as host.
    const central = user(0, 10);
    const laggy1 = user(1, 150);
    const laggy2 = user(2, 200);
    expect(findBestHost([central, laggy1, laggy2])).toBe(central);
  });

  it("falls back to the first slot when no one has ping data yet", () => {
    // Input: a session where nobody has reported a ping sample.
    // Output: the rod still has somewhere to point.
    const users = [user(0, null), user(1, null)];
    expect(findBestHost(users)).toBe(users[0]);
  });
});

describe("computeRodAngleRadians", () => {
  it("returns 0 with no users", () => {
    // Input: an empty user list.
    // Output: the rod angle should default to zero.
    expect(computeRodAngleRadians([])).toBe(0);
  });

  it("points at the single user", () => {
    // Input: one user with a ping sample.
    // Output: the rod should point directly at that user's wheel position.
    const users = [user(0, 100)];
    expect(computeRodAngleRadians(users)).toBeCloseTo(wheelAngleRadians(0, 1));
  });

  it("points at the only user even without a ping sample", () => {
    // Input: one user with no ping sample in an otherwise empty session.
    // Output: the rod should still point at that user's slot.
    const users = [user(0, null)];
    expect(computeRodAngleRadians(users)).toBeCloseTo(wheelAngleRadians(0, 1));
  });

  it("points at whichever user gives the lowest combined ping", () => {
    // Input: a well-connected user and a laggier user in opposite slots.
    // Output: the rod should point at the well-connected (better host)
    // user's slot, not the laggy one.
    const central = user(0, 20);
    const laggy = user(1, 200);
    const angle = computeRodAngleRadians([central, laggy]);
    expect(angle).toBeCloseTo(wheelAngleRadians(0, 2));
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
