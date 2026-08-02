interface SessionLocation {
  host: string;
  protocol: "http" | "https";
}

/** Maps a session id to the machine it was created on, so a friend opening a shared link can be routed there without knowing the region. */
export class SessionIndex {
  private sessions = new Map<string, SessionLocation>();

  record(sessionId: string, location: SessionLocation): void {
    this.sessions.set(sessionId.toUpperCase(), location);
  }

  lookup(sessionId: string): SessionLocation | null {
    return this.sessions.get(sessionId.toUpperCase()) ?? null;
  }
}
