export const MAX_USERS_PER_SESSION = 12;
export const PING_INTERVAL_MS = 2000;
export const PING_SAMPLE_SIZE = 5;
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_ID_LENGTH = 6;

export interface User {
  userId: string;
  userName: string;
  slotIndex: number;
  /** Round-trip ping to the signaling server — a connectivity indicator only. */
  ping: number | null;
  clientId: string;
}

/**
 * Measured peer-to-peer round-trip latency, gathered over direct WebRTC data
 * channels between participants. `pingMatrix[a][b]` is the RTT `a` measured
 * to `b`; entries are populated independently by each side as their data
 * channel comes up; a measurement can be present on the `a -> b` side and
 * still be missing on `b -> a` until that peer reports back. This is what
 * host recommendation math is now built on, in place of the old estimate.
 */
export type PingMatrix = Record<string, Record<string, number>>;

export interface SessionState {
  sessionId: string;
  users: User[];
  pingMatrix: PingMatrix;
}

/** Opaque WebRTC signaling payload (SDP offer/answer or an ICE candidate), relayed as-is. */
export type WebRTCSignal = unknown;

export type ClientMessage =
  | { type: "join"; payload: { sessionId: string; userName: string; clientId?: string } }
  | { type: "ping"; payload: { t: number } }
  | { type: "ping_report"; payload: { ping: number } }
  | { type: "webrtc_signal"; payload: { targetUserId: string; signal: WebRTCSignal } }
  | { type: "peer_ping_report"; payload: { peerUserId: string; ping: number } };

export type ServerMessage =
  | { type: "session_state"; payload: { users: User[]; pingMatrix: PingMatrix } }
  | { type: "pong"; payload: { t: number } }
  | { type: "user_joined"; payload: { user: User } }
  | { type: "user_left"; payload: { user: User } }
  | { type: "ping_update"; payload: { userId: string; ping: number } }
  | { type: "peer_ping_update"; payload: { fromUserId: string; toUserId: string; ping: number } }
  | { type: "webrtc_signal"; payload: { fromUserId: string; signal: WebRTCSignal } }
  | { type: "error"; payload: { message: string } };
