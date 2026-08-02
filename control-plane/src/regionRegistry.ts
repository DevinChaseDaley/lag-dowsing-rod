import type { MachinesClient, ProvisionedMachine } from "./machinesClient.js";

const DEFAULT_SWEEP_INTERVAL_MS = 60_000;
const DEFAULT_IDLE_GRACE_MS = 10 * 60_000;

interface RegionEntry {
  machine: ProvisionedMachine;
  /** Timestamp the machine first reported 0 active sessions, or null while active/unknown. */
  emptySince: number | null;
}

export interface RegionRegistryOptions {
  sweepIntervalMs?: number;
  idleGraceMs?: number;
}

export class RegionRegistry {
  private regions = new Map<string, RegionEntry>();
  private readonly idleGraceMs: number;

  constructor(
    private readonly machinesClient: MachinesClient,
    options: RegionRegistryOptions = {},
  ) {
    this.idleGraceMs = options.idleGraceMs ?? DEFAULT_IDLE_GRACE_MS;
    setInterval(() => void this.sweep(), options.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS);
  }

  async getOrCreateMachine(region: string): Promise<ProvisionedMachine> {
    const existing = this.regions.get(region);
    if (existing) {
      existing.emptySince = null;
      return existing.machine;
    }

    const machine = await this.machinesClient.create(region);
    await this.machinesClient.waitHealthy(machine);
    this.regions.set(region, { machine, emptySince: null });
    return machine;
  }

  regionCount(): number {
    return this.regions.size;
  }

  async sweep(): Promise<void> {
    const now = Date.now();
    for (const [region, entry] of this.regions.entries()) {
      const status = await this.machinesClient.status(entry.machine);
      if (status === null) continue;

      if (status.activeSessions > 0) {
        entry.emptySince = null;
        continue;
      }

      if (entry.emptySince === null) {
        entry.emptySince = now;
        continue;
      }

      if (now - entry.emptySince >= this.idleGraceMs) {
        await this.machinesClient.destroy(entry.machine);
        this.regions.delete(region);
      }
    }
  }
}
