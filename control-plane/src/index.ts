import Fastify from "fastify";
import cors from "@fastify/cors";
import { flyRegionForPlatform } from "@lag-dowsing-rod/shared";
import { RegionRegistry } from "./regionRegistry.js";
import { SessionIndex } from "./sessionIndex.js";
import { FlyMachinesClient, LocalMachinesClient, type MachinesClient } from "./machinesClient.js";

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "0.0.0.0";

function buildMachinesClient(): MachinesClient {
  const apiToken = process.env.FLY_API_TOKEN;
  if (!apiToken) {
    return new LocalMachinesClient();
  }

  return new FlyMachinesClient({
    apiToken,
    appPrefix: process.env.FLY_APP_PREFIX ?? "lag-dowsing-rod",
    orgSlug: process.env.FLY_ORG_SLUG ?? "personal",
    // Not FLY_IMAGE_REF: Fly auto-injects that name into every machine's own
    // env (pointing at the machine's own image), which silently shadows a
    // same-named secret.
    imageRef: process.env.GAME_SERVER_IMAGE_REF ?? "registry.fly.io/lag-dowsing-rod:latest",
  });
}

export async function createApp(machinesClient: MachinesClient = buildMachinesClient()) {
  const app = Fastify({ logger: false });
  const registry = new RegionRegistry(machinesClient);
  const sessionIndex = new SessionIndex();

  await app.register(cors, { origin: true });

  app.post<{ Body: { region?: string; platform?: string } }>("/control/sessions", async (request, reply) => {
    const requestedRegion =
      request.body?.region ?? (request.body?.platform ? flyRegionForPlatform(request.body.platform) : null);

    if (!requestedRegion) {
      return reply.code(400).send({ error: "A region or known platform is required" });
    }

    let machine;
    try {
      machine = await registry.getOrCreateMachine(requestedRegion);
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: "Could not provision a server for that region" });
    }

    let sessionResponse: Response;
    try {
      sessionResponse = await fetch(`${machine.protocol}://${machine.host}/api/sessions`, {
        method: "POST",
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: "Could not reach the provisioned server" });
    }
    if (!sessionResponse.ok) {
      return reply.code(502).send({ error: "Could not create a session on the provisioned server" });
    }

    const { sessionId } = (await sessionResponse.json()) as { sessionId: string };
    sessionIndex.record(sessionId, { host: machine.host, protocol: machine.protocol });

    return { sessionId, host: machine.host, protocol: machine.protocol };
  });

  app.get<{ Params: { id: string } }>("/control/sessions/:id", async (request, reply) => {
    const location = sessionIndex.lookup(request.params.id);
    if (!location) {
      return reply.code(404).send({ error: "Session not found" });
    }

    return { sessionId: request.params.id.toUpperCase(), host: location.host, protocol: location.protocol };
  });

  return { app, registry, sessionIndex };
}

export async function startServer() {
  const { app } = await createApp();
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Control plane listening on ${HOST}:${PORT}`);
  return app;
}

if (process.env.NODE_ENV !== "test") {
  await startServer();
}
