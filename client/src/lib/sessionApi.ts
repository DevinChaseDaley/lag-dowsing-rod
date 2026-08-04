function getServerUrl(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:3001";
}

export function getWebSocketUrl(): string {
  return `${getServerUrl().replace(/^http/, "ws")}/ws`;
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

export async function createSession(): Promise<string> {
  const response = await fetch(`${getServerUrl()}/api/sessions`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to create session");
  }

  const data = (await response.json()) as { sessionId: string };
  return data.sessionId;
}

export async function sessionExists(sessionId: string): Promise<boolean> {
  const response = await fetch(`${getServerUrl()}/api/sessions/${encodeURIComponent(sessionId)}`);
  return response.ok;
}

export function getSessionShareUrl(sessionId: string): string {
  return `${window.location.origin}/session/${sessionId}`;
}
