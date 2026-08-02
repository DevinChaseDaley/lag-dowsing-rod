export interface ProvisionedMachine {
  machineId: string;
  host: string;
  protocol: "http" | "https";
  region: string;
}

export interface MachinesClient {
  create(region: string): Promise<ProvisionedMachine>;
  waitHealthy(machine: ProvisionedMachine): Promise<void>;
  destroy(machine: ProvisionedMachine): Promise<void>;
  status(machine: ProvisionedMachine): Promise<{ activeSessions: number } | null>;
}

export interface FlyMachinesClientConfig {
  apiToken: string;
  appPrefix: string;
  orgSlug: string;
  imageRef: string;
}

const FLY_API_BASE = "https://api.machines.dev/v1";
// IP allocation isn't exposed by the Machines REST API, only Fly's older GraphQL API.
const FLY_GRAPHQL_API = "https://api.fly.io/graphql";

/**
 * One Fly app per region, holding a single machine, so the region's public
 * `<app>.fly.dev` hostname deterministically routes to that machine without
 * needing fly-replay-based instance targeting.
 */
export class FlyMachinesClient implements MachinesClient {
  constructor(private readonly config: FlyMachinesClientConfig) {}

  async create(region: string): Promise<ProvisionedMachine> {
    const appName = this.appNameForRegion(region);
    await this.ensureApp(appName);

    const response = await fetch(`${FLY_API_BASE}/apps/${appName}/machines`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        region,
        config: {
          image: this.config.imageRef,
          auto_destroy: false,
          services: [
            {
              protocol: "tcp",
              internal_port: 3001,
              ports: [{ port: 443, handlers: ["tls", "http"] }],
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Fly Machines API error creating machine: ${response.status} ${await response.text()}`);
    }

    const machine = (await response.json()) as { id: string };
    return { machineId: machine.id, host: `${appName}.fly.dev`, protocol: "https", region };
  }

  async waitHealthy(machine: ProvisionedMachine): Promise<void> {
    const appName = this.appNameForRegion(machine.region);
    const response = await fetch(
      `${FLY_API_BASE}/apps/${appName}/machines/${machine.machineId}/wait?state=started&timeout=60`,
      { headers: this.headers() },
    );
    if (!response.ok) {
      throw new Error(`Machine ${machine.machineId} did not become healthy: ${response.status}`);
    }

    // "started" only means the VM booted -- for a brand-new app, DNS/edge
    // routing for its freshly allocated IP can lag behind that by tens of
    // seconds, so poll the app's own status route until it's actually
    // reachable through the public hostname before declaring it ready.
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if ((await this.status(machine)) !== null) return;
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    throw new Error(`Machine ${machine.machineId} booted but never became reachable at ${machine.host}`);
  }

  async destroy(machine: ProvisionedMachine): Promise<void> {
    const appName = this.appNameForRegion(machine.region);
    await fetch(`${FLY_API_BASE}/apps/${appName}/machines/${machine.machineId}?force=true`, {
      method: "DELETE",
      headers: this.headers(),
    });
  }

  async status(machine: ProvisionedMachine): Promise<{ activeSessions: number } | null> {
    try {
      const response = await fetch(`${machine.protocol}://${machine.host}/api/status`);
      if (!response.ok) return null;
      return (await response.json()) as { activeSessions: number };
    } catch {
      return null;
    }
  }

  private appNameForRegion(region: string): string {
    return `${this.config.appPrefix}-${region}`;
  }

  private async ensureApp(appName: string): Promise<void> {
    const existing = await fetch(`${FLY_API_BASE}/apps/${appName}`, { headers: this.headers() });
    if (existing.ok) return;

    const created = await fetch(`${FLY_API_BASE}/apps`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ app_name: appName, org_slug: this.config.orgSlug }),
    });
    if (!created.ok && created.status !== 422) {
      throw new Error(`Failed to create Fly app ${appName}: ${created.status} ${await created.text()}`);
    }

    // A freshly created app has no public IP, so <app>.fly.dev won't route
    // anywhere until we allocate one — flyctl's own deploy flow does this
    // automatically, but the Machines API alone does not.
    await this.allocateIp(appName, "shared_v4");
    await this.allocateIp(appName, "v6");
  }

  private async allocateIp(appName: string, type: "shared_v4" | "v6"): Promise<void> {
    const response = await fetch(FLY_GRAPHQL_API, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        query:
          "mutation($input: AllocateIPAddressInput!) { allocateIpAddress(input: $input) { ipAddress { id } } }",
        variables: { input: { appId: appName, type } },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to allocate ${type} IP for ${appName}: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as { errors?: { message: string }[] };
    if (body.errors?.length) {
      throw new Error(`Failed to allocate ${type} IP for ${appName}: ${body.errors[0].message}`);
    }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiToken}`,
      "Content-Type": "application/json",
    };
  }
}

/**
 * Dev fallback used when no FLY_API_TOKEN is configured: every region
 * resolves to the single locally running game server (`npm run dev`),
 * so the control-plane hop can be exercised end-to-end without Fly.
 */
export class LocalMachinesClient implements MachinesClient {
  constructor(private readonly host: string = "localhost:3001") {}

  async create(region: string): Promise<ProvisionedMachine> {
    return { machineId: `local-${region}`, host: this.host, protocol: "http", region };
  }

  async waitHealthy(): Promise<void> {}

  async destroy(): Promise<void> {}

  async status(machine: ProvisionedMachine): Promise<{ activeSessions: number } | null> {
    try {
      const response = await fetch(`${machine.protocol}://${machine.host}/api/status`);
      if (!response.ok) return null;
      return (await response.json()) as { activeSessions: number };
    } catch {
      return null;
    }
  }
}
