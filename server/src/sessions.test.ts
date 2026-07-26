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
});
