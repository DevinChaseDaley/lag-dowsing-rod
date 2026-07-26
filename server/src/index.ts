import Fastify from "fastify";
import cors from "@fastify/cors";
import { WebSocketServer } from "ws";
import { SessionManager } from "./sessions.js";
import { WebSocketHub } from "./wsHandler.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });
const sessions = new SessionManager();
const hub = new WebSocketHub(sessions);

await app.register(cors, {
  origin: true,
});

app.post("/api/sessions", async () => {
  const sessionId = sessions.createSession();
  return { sessionId };
});

app.get<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
  const exists = sessions.sessionExists(request.params.id);
  if (!exists) {
    return reply.code(404).send({ error: "Session not found" });
  }
  return { sessionId: request.params.id.toUpperCase(), exists: true };
});

await app.listen({ port: PORT, host: HOST });

const wss = new WebSocketServer({ noServer: true });

app.server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "", `http://${request.headers.host}`);

  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    hub.handleConnection(ws);
  });
});

app.log.info(`WebSocket endpoint available at ws://${HOST}:${PORT}/ws`);
