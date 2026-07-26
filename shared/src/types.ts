export const MAX_USERS_PER_SESSION = 12;
export const PING_INTERVAL_MS = 2000;
export const PING_SAMPLE_SIZE = 5;
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_ID_LENGTH = 6;

export interface User {
  userId: string;
  userName: string;
  slotIndex: number;
  ping: number | null;
  clientId: string;
}

export interface SessionState {
  sessionId: string;
  users: User[];
}

export type ClientMessage =
  | { type: "join"; payload: { sessionId: string; userName: string; clientId?: string } }
  | { type: "ping"; payload: { t: number } }
  | { type: "ping_report"; payload: { ping: number } };

export type ServerMessage =
  | { type: "session_state"; payload: { users: User[] } }
  | { type: "pong"; payload: { t: number } }
  | { type: "user_joined"; payload: { user: User } }
  | { type: "user_left"; payload: { user: User } }
  | { type: "ping_update"; payload: { userId: string; ping: number } }
  | { type: "error"; payload: { message: string } };
