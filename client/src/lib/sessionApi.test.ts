import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  getClientId,
  getStoredUserName,
  resolveSession,
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

  it("creates a session via the control-plane and stores its location", async () => {
    // Input: a successful control-plane POST response naming the provisioned host.
    // Output: the helper should resolve with the session id and hit the control-plane, not the game server directly.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: "ABC123", host: "fake-ams.test", protocol: "http" }),
    } as Response);

    await expect(createSession("ams")).resolves.toBe("ABC123");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/control/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: "ams" }),
    });
  });

  it("resolves a session's location via the control-plane when nothing is cached", async () => {
    // Input: a friend opening a shared link with no host cached locally.
    // Output: the helper looks up the host via the control-plane, then confirms the session still exists there.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ host: "fake-ams.test", protocol: "http" }),
    } as Response);
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);

    await expect(resolveSession("abc123")).resolves.toEqual({ host: "fake-ams.test", protocol: "http" });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/control/sessions/abc123");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://fake-ams.test/api/sessions/abc123");
  });

  it("returns null when the control-plane has no record of the session", async () => {
    // Input: a control-plane lookup that 404s.
    // Output: the helper should resolve to null without checking the game server.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({ ok: false } as Response);

    await expect(resolveSession("missing")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("skips the control-plane lookup once a session's host is cached", async () => {
    // Input: a session already created locally, so its host is in session storage.
    // Output: resolving it again should only re-check the game server, not the control-plane.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: "ABC123", host: "fake-ams.test", protocol: "http" }),
    } as Response);
    await createSession("ams");

    fetchMock.mockResolvedValueOnce({ ok: true } as Response);
    await expect(resolveSession("ABC123")).resolves.toEqual({ host: "fake-ams.test", protocol: "http" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://fake-ams.test/api/sessions/ABC123");
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
