import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./index.js";
import { FakeMachinesClient } from "./testFakes.js";

function mockSessionFetch(sessionId: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/sessions")) {
        return new Response(JSON.stringify({ sessionId }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }),
  );
}

describe("control-plane session routes", () => {
  let machinesClient: FakeMachinesClient;
  let app: Awaited<ReturnType<typeof createApp>>["app"];

  beforeEach(() => {
    machinesClient = new FakeMachinesClient();
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
  });

  it("provisions a new machine for a region with no existing machine", async () => {
    mockSessionFetch("ABC123");
    ({ app } = await createApp(machinesClient));

    const response = await app.inject({
      method: "POST",
      url: "/control/sessions",
      payload: { region: "ams" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ sessionId: "ABC123", host: "fake-ams.test" });
    expect(machinesClient.createCalls).toEqual(["ams"]);
  });

  it("reuses an existing region machine across a second session", async () => {
    mockSessionFetch("DEF456");
    ({ app } = await createApp(machinesClient));

    await app.inject({ method: "POST", url: "/control/sessions", payload: { region: "ams" } });
    const second = await app.inject({ method: "POST", url: "/control/sessions", payload: { region: "ams" } });

    expect(second.statusCode).toBe(200);
    expect(machinesClient.createCalls).toEqual(["ams"]);
  });

  it("resolves a known LoL platform to its Fly region", async () => {
    mockSessionFetch("GHI789");
    ({ app } = await createApp(machinesClient));

    const response = await app.inject({
      method: "POST",
      url: "/control/sessions",
      payload: { platform: "euw1" },
    });

    expect(response.statusCode).toBe(200);
    expect(machinesClient.createCalls).toEqual(["ams"]);
  });

  it("returns 502 when the provisioned server is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fetch failed");
      }),
    );
    ({ app } = await createApp(machinesClient));

    const response = await app.inject({
      method: "POST",
      url: "/control/sessions",
      payload: { region: "ams" },
    });

    expect(response.statusCode).toBe(502);
  });

  it("rejects a request with no region or known platform", async () => {
    ({ app } = await createApp(machinesClient));

    const response = await app.inject({
      method: "POST",
      url: "/control/sessions",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(machinesClient.createCalls).toEqual([]);
  });

  it("looks up a previously created session's host", async () => {
    mockSessionFetch("JKL012");
    ({ app } = await createApp(machinesClient));

    await app.inject({ method: "POST", url: "/control/sessions", payload: { region: "sea" } });
    const response = await app.inject({ method: "GET", url: "/control/sessions/jkl012" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ sessionId: "JKL012", host: "fake-sea.test" });
  });

  it("returns 404 looking up an unknown session", async () => {
    ({ app } = await createApp(machinesClient));

    const response = await app.inject({ method: "GET", url: "/control/sessions/nope00" });

    expect(response.statusCode).toBe(404);
  });
});
