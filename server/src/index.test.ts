import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./index.js";

describe("session API routes", () => {
  let app: Awaited<ReturnType<typeof createApp>>["app"];

  beforeEach(async () => {
    ({ app } = await createApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a session and returns the new id", async () => {
    // Input: a POST request to /api/sessions.
    // Output: a 200 response with a generated session id.
    const response = await app.inject({
      method: "POST",
      url: "/api/sessions",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ sessionId: expect.any(String) });
  });

  it("returns 404 for a missing session", async () => {
    // Input: a GET request for a session that does not exist.
    // Output: a 404 response with an error message.
    const response = await app.inject({
      method: "GET",
      url: "/api/sessions/does-not-exist",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Session not found" });
  });

  it("returns the session id in uppercase when it exists", async () => {
    // Input: a newly created session id followed by a GET request for that same id.
    // Output: the API should return the session id in uppercase and indicate it exists.
    const created = await app.inject({
      method: "POST",
      url: "/api/sessions",
    });
    const sessionId = created.json<{ sessionId: string }>().sessionId;

    const response = await app.inject({
      method: "GET",
      url: `/api/sessions/${sessionId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ sessionId: sessionId.toUpperCase(), exists: true });
  });
});
