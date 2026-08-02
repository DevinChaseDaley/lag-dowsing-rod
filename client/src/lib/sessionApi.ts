export interface SessionLocation {
  host: string;
  protocol: "http" | "https";
}

function getControlPlaneUrl(): string {
  return import.meta.env.VITE_CONTROL_PLANE_URL ?? "http://localhost:4000";
}

function hostKey(sessionId: string): string {
  return `lag-dowsing-rod:host:${sessionId.toUpperCase()}`;
}

function storeSessionLocation(sessionId: string, location: SessionLocation): void {
  sessionStorage.setItem(hostKey(sessionId), JSON.stringify(location));
}

function getStoredSessionLocation(sessionId: string): SessionLocation | null {
  const raw = sessionStorage.getItem(hostKey(sessionId));
  return raw ? (JSON.parse(raw) as SessionLocation) : null;
}

export function getWebSocketUrl(location: SessionLocation): string {
  const protocol = location.protocol === "https" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws`;
}

export function getClientId(sessionId: string): string {
  const key = `lag-dowsing-rod:client:${sessionId}`;
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;

  const clientId = crypto.randomUUID();
  sessionStorage.setItem(key, clientId);
  return clientId;
}

export function getStoredUserName(): string {
  return sessionStorage.getItem("lag-dowsing-rod:userName") ?? "";
}

export function storeUserName(userName: string): void {
  sessionStorage.setItem("lag-dowsing-rod:userName", userName.trim());
}

export async function createSession(region: string): Promise<string> {
  const response = await fetch(`${getControlPlaneUrl()}/control/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region }),
  });
  if (!response.ok) {
    throw new Error("Failed to create session");
  }

  const data = (await response.json()) as { sessionId: string; host: string; protocol: "http" | "https" };
  storeSessionLocation(data.sessionId, { host: data.host, protocol: data.protocol });
  return data.sessionId;
}

/**
 * Resolves where a session lives, going through the control-plane only when
 * a friend opens a shared link and no host is cached locally yet.
 */
export async function resolveSession(sessionId: string): Promise<SessionLocation | null> {
  let location = getStoredSessionLocation(sessionId);

  if (!location) {
    const response = await fetch(`${getControlPlaneUrl()}/control/sessions/${encodeURIComponent(sessionId)}`);
    if (!response.ok) return null;

    const data = (await response.json()) as { host: string; protocol: "http" | "https" };
    location = { host: data.host, protocol: data.protocol };
    storeSessionLocation(sessionId, location);
  }

  const exists = await fetch(
    `${location.protocol}://${location.host}/api/sessions/${encodeURIComponent(sessionId)}`,
  );
  return exists.ok ? location : null;
}

export function getSessionShareUrl(sessionId: string): string {
  return `${window.location.origin}/session/${sessionId}`;
}
