import { describe, expect, it } from "vitest";
import { SessionManager } from "./sessions.js";

describe("SessionManager", () => {
  it("compacts slot indexes when users leave and new users join", () => {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession();

    const first = sessions.joinSession(sessionId, "Alice");
    const second = sessions.joinSession(sessionId, "Bob");
    const third = sessions.joinSession(sessionId, "Cara");

    expect(first).toMatchObject({ reconnected: false });
    expect(second).toMatchObject({ reconnected: false });
    expect(third).toMatchObject({ reconnected: false });

    if ("error" in first || "error" in second || "error" in third) {
      throw new Error("Expected all joins to succeed");
    }

    const beforeLeave = sessions.getUsers(sessionId).map((user) => user.slotIndex);
    expect(beforeLeave).toEqual([0, 1, 2]);

    sessions.leaveSession(sessionId, second.user.userId);

    const afterLeave = sessions.getUsers(sessionId).map((user) => user.slotIndex);
    expect(afterLeave).toEqual([0, 1]);

    const fourth = sessions.joinSession(sessionId, "Drew");

    if ("error" in fourth) {
      throw new Error("Expected the new join to succeed");
    }

    const afterJoin = sessions.getUsers(sessionId).map((user) => user.slotIndex);
    expect(afterJoin).toEqual([0, 1, 2]);
    expect(fourth).toMatchObject({ reconnected: false });
    expect(fourth.user.slotIndex).toBe(2);
  });

  it("records peer-to-peer ping reports in the session's ping matrix", () => {
    // Input: two joined users, one reporting a measured ping to the other.
    // Output: the matrix reflects that single directed measurement.
    const sessions = new SessionManager();
    const sessionId = sessions.createSession();

    const alice = sessions.joinSession(sessionId, "Alice");
    const bob = sessions.joinSession(sessionId, "Bob");
    if ("error" in alice || "error" in bob) {
      throw new Error("Expected both joins to succeed");
    }

    const recorded = sessions.updatePeerPing(sessionId, alice.user.userId, bob.user.userId, 42.6);
    expect(recorded).toBe(true);
    expect(sessions.getPingMatrix(sessionId)).toEqual({
      [alice.user.userId]: { [bob.user.userId]: 43 },
    });
  });

  it("rejects peer ping reports naming a participant who isn't in the session", () => {
    // Input: a report naming a userId that never joined.
    // Output: the report is rejected and the matrix stays empty.
    const sessions = new SessionManager();
    const sessionId = sessions.createSession();
    const alice = sessions.joinSession(sessionId, "Alice");
    if ("error" in alice) {
      throw new Error("Expected the join to succeed");
    }

    const recorded = sessions.updatePeerPing(sessionId, alice.user.userId, "nonexistent-user", 10);
    expect(recorded).toBe(false);
    expect(sessions.getPingMatrix(sessionId)).toEqual({});
  });

  it("clears a departed user's ping matrix entries in both directions", () => {
    // Input: two users with pings measured in both directions, then one leaves.
    // Output: every matrix entry involving the departed user is gone.
    const sessions = new SessionManager();
    const sessionId = sessions.createSession();
    const alice = sessions.joinSession(sessionId, "Alice");
    const bob = sessions.joinSession(sessionId, "Bob");
    if ("error" in alice || "error" in bob) {
      throw new Error("Expected both joins to succeed");
    }

    sessions.updatePeerPing(sessionId, alice.user.userId, bob.user.userId, 20);
    sessions.updatePeerPing(sessionId, bob.user.userId, alice.user.userId, 30);
    sessions.leaveSession(sessionId, bob.user.userId);

    expect(sessions.getPingMatrix(sessionId)).toEqual({});
  });
});
