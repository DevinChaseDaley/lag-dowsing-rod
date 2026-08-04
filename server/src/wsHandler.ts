import type { WebSocket } from "ws";
import type { ClientMessage, ServerMessage, WebRTCSignal } from "@lag-dowsing-rod/shared";
import type { SessionManager } from "./sessions.js";

interface ConnectedClient {
  socket: WebSocket;
  sessionId: string;
  userId: string;
}

export class WebSocketHub {
  private clients = new Map<WebSocket, ConnectedClient>();
  private sessionSockets = new Map<string, Set<WebSocket>>();

  constructor(private readonly sessions: SessionManager) {}

  handleConnection(socket: WebSocket): void {
    socket.on("message", (raw) => {
      this.handleMessage(socket, raw.toString());
    });

    socket.on("close", () => {
      this.handleDisconnect(socket);
    });

    socket.on("error", () => {
      this.handleDisconnect(socket);
    });
  }

  private handleMessage(socket: WebSocket, raw: string): void {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send(socket, { type: "error", payload: { message: "Invalid message format" } });
      return;
    }

    switch (message.type) {
      case "join":
        this.handleJoin(socket, message.payload);
        break;
      case "ping":
        this.send(socket, { type: "pong", payload: { t: message.payload.t } });
        break;
      case "ping_report":
        this.handlePingReport(socket, message.payload.ping);
        break;
      case "webrtc_signal":
        this.handleSignal(socket, message.payload);
        break;
      case "peer_ping_report":
        this.handlePeerPingReport(socket, message.payload);
        break;
      default:
        this.send(socket, { type: "error", payload: { message: "Unknown message type" } });
    }
  }

  private handleJoin(
    socket: WebSocket,
    payload: { sessionId: string; userName: string; clientId?: string },
  ): void {
    const result = this.sessions.joinSession(payload.sessionId, payload.userName, payload.clientId);
    if ("error" in result) {
      this.send(socket, { type: "error", payload: { message: result.error } });
      return;
    }

    const sessionId = payload.sessionId.toUpperCase();
    const existing = this.clients.get(socket);
    if (existing) {
      this.removeFromSession(existing.sessionId, socket);
    }

    this.clients.set(socket, {
      socket,
      sessionId,
      userId: result.user.userId,
    });

    this.addToSession(sessionId, socket);
    this.send(socket, {
      type: "session_state",
      payload: { users: this.sessions.getUsers(sessionId), pingMatrix: this.sessions.getPingMatrix(sessionId) },
    });

    if (!result.reconnected) {
      this.broadcast(sessionId, { type: "user_joined", payload: { user: result.user } }, socket);
      this.broadcastSessionState(sessionId);
    }
  }

  private handlePingReport(socket: WebSocket, ping: number): void {
    const client = this.clients.get(socket);
    if (!client) return;

    const updated = this.sessions.updatePing(client.sessionId, client.userId, ping);
    if (!updated) return;

    this.broadcast(client.sessionId, {
      type: "ping_update",
      payload: { userId: updated.userId, ping: updated.ping ?? ping },
    });
    this.broadcastSessionState(client.sessionId);
  }

  /**
   * Relays an SDP offer/answer or ICE candidate to another participant in
   * the same session so the two browsers can negotiate a direct WebRTC
   * connection. The server never inspects the signal payload itself.
   */
  private handleSignal(socket: WebSocket, payload: { targetUserId: string; signal: WebRTCSignal }): void {
    const client = this.clients.get(socket);
    if (!client) return;

    const targetSocket = this.findSocketForUser(client.sessionId, payload.targetUserId);
    if (!targetSocket) return;

    this.send(targetSocket, {
      type: "webrtc_signal",
      payload: { fromUserId: client.userId, signal: payload.signal },
    });
  }

  private handlePeerPingReport(socket: WebSocket, payload: { peerUserId: string; ping: number }): void {
    const client = this.clients.get(socket);
    if (!client) return;

    const updated = this.sessions.updatePeerPing(client.sessionId, client.userId, payload.peerUserId, payload.ping);
    if (!updated) return;

    this.broadcast(client.sessionId, {
      type: "peer_ping_update",
      payload: { fromUserId: client.userId, toUserId: payload.peerUserId, ping: payload.ping },
    });
    this.broadcastSessionState(client.sessionId);
  }

  private handleDisconnect(socket: WebSocket): void {
    const client = this.clients.get(socket);
    if (!client) return;

    const removed = this.sessions.leaveSession(client.sessionId, client.userId);
    this.clients.delete(socket);
    this.removeFromSession(client.sessionId, socket);

    if (removed) {
      this.broadcast(client.sessionId, { type: "user_left", payload: { user: removed } });
      this.broadcastSessionState(client.sessionId);
    }
  }

  private broadcastSessionState(sessionId: string): void {
    this.broadcast(sessionId, {
      type: "session_state",
      payload: { users: this.sessions.getUsers(sessionId), pingMatrix: this.sessions.getPingMatrix(sessionId) },
    });
  }

  private broadcast(sessionId: string, message: ServerMessage, exclude?: WebSocket): void {
    const sockets = this.sessionSockets.get(sessionId);
    if (!sockets) return;

    for (const socket of sockets) {
      if (socket !== exclude && socket.readyState === socket.OPEN) {
        this.send(socket, message);
      }
    }
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private addToSession(sessionId: string, socket: WebSocket): void {
    if (!this.sessionSockets.has(sessionId)) {
      this.sessionSockets.set(sessionId, new Set());
    }
    this.sessionSockets.get(sessionId)?.add(socket);
  }

  private removeFromSession(sessionId: string, socket: WebSocket): void {
    const sockets = this.sessionSockets.get(sessionId);
    if (!sockets) return;

    sockets.delete(socket);
    if (sockets.size === 0) {
      this.sessionSockets.delete(sessionId);
    }
  }

  private findSocketForUser(sessionId: string, userId: string): WebSocket | undefined {
    const sockets = this.sessionSockets.get(sessionId);
    if (!sockets) return undefined;

    for (const socket of sockets) {
      if (this.clients.get(socket)?.userId === userId) {
        return socket;
      }
    }
    return undefined;
  }
}
