import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  getClientId,
  getStoredUserName,
  storeUserName,
  validateSession,
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

  it("creates a session from the POST /api/sessions endpoint", async () => {
    // Input: a successful POST response containing a session id.
    // Output: the helper should resolve with that session id.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: "ABC123" }),
    } as Response);

    await expect(createSession()).resolves.toBe("ABC123");
    expect(fetchMock).toHaveBeenCalledWith("/api/sessions", { method: "POST" });
  });

  it("validates an existing session and rejects a missing one", async () => {
    // Input: one successful lookup and one failed lookup for a session id.
    // Output: the helper should return true for the existing session and false for the missing one.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);
    await expect(validateSession("abc123")).resolves.toBe(true);

    fetchMock.mockResolvedValueOnce({ ok: false } as Response);
    await expect(validateSession("missing")).resolves.toBe(false);
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
