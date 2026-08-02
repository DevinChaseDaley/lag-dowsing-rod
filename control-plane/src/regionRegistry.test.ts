import { describe, expect, it } from "vitest";
import { RegionRegistry } from "./regionRegistry.js";
import { FakeMachinesClient } from "./testFakes.js";

describe("RegionRegistry", () => {
  it("reuses a machine already provisioned for a region", async () => {
    const client = new FakeMachinesClient();
    const registry = new RegionRegistry(client, { sweepIntervalMs: 1_000_000 });

    const first = await registry.getOrCreateMachine("ams");
    const second = await registry.getOrCreateMachine("ams");

    expect(first).toEqual(second);
    expect(client.createCalls).toEqual(["ams"]);
  });

  it("provisions separate machines for different regions", async () => {
    const client = new FakeMachinesClient();
    const registry = new RegionRegistry(client, { sweepIntervalMs: 1_000_000 });

    await registry.getOrCreateMachine("ams");
    await registry.getOrCreateMachine("sea");

    expect(client.createCalls).toEqual(["ams", "sea"]);
    expect(registry.regionCount()).toBe(2);
  });

  it("destroys a machine only after it has been idle past the grace period", async () => {
    const client = new FakeMachinesClient();
    const registry = new RegionRegistry(client, { sweepIntervalMs: 1_000_000, idleGraceMs: 10 });

    const machine = await registry.getOrCreateMachine("ams");
    client.setStatus(machine.host, { activeSessions: 0 });

    await registry.sweep();
    expect(client.destroyCalls).toHaveLength(0);
    expect(registry.regionCount()).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 20));
    await registry.sweep();

    expect(client.destroyCalls).toEqual([machine]);
    expect(registry.regionCount()).toBe(0);
  });

  it("does not destroy a machine that has active sessions", async () => {
    const client = new FakeMachinesClient();
    const registry = new RegionRegistry(client, { sweepIntervalMs: 1_000_000, idleGraceMs: 10 });

    const machine = await registry.getOrCreateMachine("ams");
    client.setStatus(machine.host, { activeSessions: 3 });

    await registry.sweep();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await registry.sweep();

    expect(client.destroyCalls).toHaveLength(0);
  });

  it("resets the idle timer if a machine goes empty then becomes active again", async () => {
    const client = new FakeMachinesClient();
    const registry = new RegionRegistry(client, { sweepIntervalMs: 1_000_000, idleGraceMs: 10 });

    const machine = await registry.getOrCreateMachine("ams");
    client.setStatus(machine.host, { activeSessions: 0 });
    await registry.sweep();

    client.setStatus(machine.host, { activeSessions: 1 });
    await registry.sweep();

    client.setStatus(machine.host, { activeSessions: 0 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await registry.sweep();

    expect(client.destroyCalls).toHaveLength(0);
  });
});
