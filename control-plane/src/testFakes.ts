import type { MachinesClient, ProvisionedMachine } from "./machinesClient.js";

export class FakeMachinesClient implements MachinesClient {
  createCalls: string[] = [];
  destroyCalls: ProvisionedMachine[] = [];
  private statuses = new Map<string, { activeSessions: number } | null>();

  async create(region: string): Promise<ProvisionedMachine> {
    this.createCalls.push(region);
    return { machineId: `machine-${region}`, host: `fake-${region}.test`, protocol: "http", region };
  }

  async waitHealthy(): Promise<void> {}

  async destroy(machine: ProvisionedMachine): Promise<void> {
    this.destroyCalls.push(machine);
  }

  async status(machine: ProvisionedMachine): Promise<{ activeSessions: number } | null> {
    return this.statuses.has(machine.host) ? (this.statuses.get(machine.host) ?? null) : { activeSessions: 0 };
  }

  setStatus(host: string, status: { activeSessions: number } | null): void {
    this.statuses.set(host, status);
  }
}
