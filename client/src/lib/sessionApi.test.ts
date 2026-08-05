import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  getClientId,
  getStoredUserName,
  getWebSocketUrl,
  sessionExists,
  storeUserName,
} from "./sessionApi.js";

describe("sessionApi", () => {
  const originalWindow = globalThis.window;
  const originalSessionStorage = globalThis.sessionStorage;
  const originalCrypto = globalThis.crypto;

  beforeEach(() => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    };

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          protocol: "http:",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
      },
    });

    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: storage,
    });

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        randomUUID: () => "mock-uuid",
      },
    });

    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (originalWindow === undefined) {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: undefined,
      });
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }

    if (originalSessionStorage === undefined) {
      Object.defineProperty(globalThis, "sessionStorage", {
        configurable: true,
        value: undefined,
      });
    } else {
      Object.defineProperty(globalThis, "sessionStorage", {
        configurable: true,
        value: originalSessionStorage,
      });
    }

    if (originalCrypto === undefined) {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: undefined,
      });
    } else {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it("creates a session directly against the game server", async () => {
    // Input: a successful game-server POST response naming the new session.
    // Output: the helper resolves with the session id, hitting the game server directly.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: "ABC123" }),
    } as Response);

    await expect(createSession()).resolves.toBe("ABC123");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/sessions", { method: "POST" });
  });

  it("rejects when the game server refuses to create a session", async () => {
    // Input: a non-ok response from the game server.
    // Output: the helper rejects rather than resolving with a bad session id.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({ ok: false } as Response);

    await expect(createSession()).rejects.toThrow("Failed to create session");
  });

  it("checks whether a session exists directly against the game server", async () => {
    // Input: a friend opening a shared link.
    // Output: the helper checks the game server directly and reports existence.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);

    await expect(sessionExists("abc123")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/sessions/abc123");
  });

  it("reports false when the session doesn't exist", async () => {
    // Input: a lookup for a session id the game server doesn't recognize.
    // Output: the helper resolves to false without throwing.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({ ok: false } as Response);

    await expect(sessionExists("missing")).resolves.toBe(false);
  });

  it("builds the game server's WebSocket URL", () => {
    // Input: the default game server URL.
    // Output: the equivalent ws:// URL with the /ws path.
    expect(getWebSocketUrl()).toBe("ws://localhost:3001/ws");
  });

  it("persists the user name in session storage", () => {
    // Input: a user name with surrounding whitespace.
    // Output: the trimmed name should be stored and read back correctly.
    storeUserName("  Alice  ");
    expect(getStoredUserName()).toBe("Alice");
  });

  it("returns a stable client id for a session", () => {
    // Input: the same session id requested twice.
    // Output: the same client id should be returned on both calls.
    expect(getClientId("alpha")).toBe("mock-uuid");
    expect(getClientId("alpha")).toBe("mock-uuid");
  });
});
