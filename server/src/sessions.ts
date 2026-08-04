import { randomBytes } from "node:crypto";
import {
  MAX_USERS_PER_SESSION,
  SESSION_ID_LENGTH,
  SESSION_TTL_MS,
  type PingMatrix,
  type User,
} from "@lag-dowsing-rod/shared";

const SESSION_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

interface SessionRecord {
  sessionId: string;
  users: Map<string, User>;
  /** fromUserId -> toUserId -> measured peer-to-peer RTT in ms. */
  pingMatrix: Map<string, Map<string, number>>;
  nextSlotIndex: number;
  lastActivityAt: number;
}

export class SessionManager {
  private sessions = new Map<string, SessionRecord>();

  constructor() {
    setInterval(() => this.pruneExpiredSessions(), 60_000);
  }

  createSession(): string {
    const sessionId = this.generateSessionId();
    this.sessions.set(sessionId, {
      sessionId,
      users: new Map(),
      pingMatrix: new Map(),
      nextSlotIndex: 0,
      lastActivityAt: Date.now(),
    });
    return sessionId;
  }

  sessionExists(sessionId: string): boolean {
    this.pruneExpiredSessions();
    return this.sessions.has(sessionId.toUpperCase());
  }

  activeSessionCount(): number {
    this.pruneExpiredSessions();
    return this.sessions.size;
  }

  getUsers(sessionId: string): User[] {
    const session = this.getSession(sessionId);
    if (!session) return [];
    this.compactSlots(session);
    return [...session.users.values()].sort((a, b) => a.slotIndex - b.slotIndex);
  }

  getPingMatrix(sessionId: string): PingMatrix {
    const session = this.getSession(sessionId);
    if (!session) return {};

    const matrix: PingMatrix = {};
    for (const [fromUserId, tos] of session.pingMatrix.entries()) {
      matrix[fromUserId] = Object.fromEntries(tos);
    }
    return matrix;
  }

  joinSession(
    sessionId: string,
    userName: string,
    clientId?: string,
  ): { user: User; reconnected: boolean } | { error: string } {
    const session = this.getSession(sessionId);
    if (!session) {
      return { error: "Session not found" };
    }

    session.lastActivityAt = Date.now();
    const trimmedName = userName.trim();
    if (!trimmedName) {
      return { error: "Display name is required" };
    }

    if (clientId) {
      const existing = [...session.users.values()].find((user) => user.clientId === clientId);
      if (existing) {
        existing.userName = trimmedName;
        this.compactSlots(session);
        return { user: existing, reconnected: true };
      }
    }

    if (session.users.size >= MAX_USERS_PER_SESSION) {
      return { error: "Session is full" };
    }

    const user: User = {
      userId: randomBytes(8).toString("hex"),
      userName: trimmedName,
      slotIndex: session.nextSlotIndex,
      ping: null,
      clientId: clientId ?? randomBytes(8).toString("hex"),
    };

    session.nextSlotIndex += 1;
    session.users.set(user.userId, user);
    this.compactSlots(session);
    return { user, reconnected: false };
  }

  leaveSession(sessionId: string, userId: string): User | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const user = session.users.get(userId);
    if (!user) return null;

    session.users.delete(userId);
    session.pingMatrix.delete(userId);
    for (const [fromUserId, tos] of session.pingMatrix.entries()) {
      tos.delete(userId);
      if (tos.size === 0) {
        session.pingMatrix.delete(fromUserId);
      }
    }
    this.compactSlots(session);
    session.lastActivityAt = Date.now();
    return user;
  }

  updatePing(sessionId: string, userId: string, ping: number): User | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const user = session.users.get(userId);
    if (!user) return null;

    user.ping = Math.max(0, Math.round(ping));
    session.lastActivityAt = Date.now();
    return user;
  }

  /**
   * Records the round-trip latency `fromUserId` measured directly to
   * `toUserId` over their WebRTC data channel. Returns false if either
   * participant isn't (or is no longer) part of the session.
   */
  updatePeerPing(sessionId: string, fromUserId: string, toUserId: string, ping: number): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;
    if (!session.users.has(fromUserId) || !session.users.has(toUserId)) return false;

    if (!session.pingMatrix.has(fromUserId)) {
      session.pingMatrix.set(fromUserId, new Map());
    }
    session.pingMatrix.get(fromUserId)?.set(toUserId, Math.max(0, Math.round(ping)));
    session.lastActivityAt = Date.now();
    return true;
  }

  private getSession(sessionId: string): SessionRecord | undefined {
    this.pruneExpiredSessions();
    return this.sessions.get(sessionId.toUpperCase());
  }

  private compactSlots(session: SessionRecord): void {
    const users = [...session.users.values()].sort((a, b) => a.slotIndex - b.slotIndex);
    users.forEach((user, index) => {
      user.slotIndex = index;
    });
    session.nextSlotIndex = users.length;
  }

  private generateSessionId(): string {
    let sessionId = "";
    do {
      sessionId = Array.from({ length: SESSION_ID_LENGTH }, () => {
        const index = randomBytes(1)[0] % SESSION_CHARS.length;
        return SESSION_CHARS[index];
      }).join("");
    } while (this.sessions.has(sessionId));

    return sessionId;
  }

  private pruneExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt > SESSION_TTL_MS) {
        this.sessions.delete(sessionId);
      }
    }
  }
}
