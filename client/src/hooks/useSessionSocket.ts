import { useCallback, useEffect, useRef, useState } from "react";
import {
  PING_INTERVAL_MS,
  PING_SAMPLE_SIZE,
  rollingAverage,
  type ClientMessage,
  type ServerMessage,
  type User,
} from "@lag-dowsing-rod/shared";
import { getWebSocketUrl } from "../lib/sessionApi";

interface UseSessionSocketOptions {
  sessionId: string;
  userName: string;
  clientId: string;
  enabled: boolean;
}

interface UseSessionSocketResult {
  users: User[];
  connected: boolean;
  error: string | null;
  selfUserId: string | null;
}

export function useSessionSocket({
  sessionId,
  userName,
  clientId,
  enabled,
}: UseSessionSocketOptions): UseSessionSocketResult {
  const [users, setUsers] = useState<User[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const samplesRef = useRef<number[]>([]);
  const joinedRef = useRef(false);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  const reportPing = useCallback(() => {
    const average = rollingAverage(samplesRef.current, PING_SAMPLE_SIZE);
    if (average !== null) {
      send({ type: "ping_report", payload: { ping: average } });
    }
  }, [send]);

  useEffect(() => {
    if (!enabled || !sessionId || !userName) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const socket = new WebSocket(getWebSocketUrl());
      socketRef.current = socket;
      joinedRef.current = false;

      socket.addEventListener("open", () => {
        setConnected(true);
        setError(null);
        send({
          type: "join",
          payload: { sessionId, userName, clientId },
        });
      });

      socket.addEventListener("message", (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }

        switch (message.type) {
          case "session_state":
            setUsers(message.payload.users);
            if (!joinedRef.current) {
              const self = message.payload.users.find((user) => user.clientId === clientId);
              if (self) {
                setSelfUserId(self.userId);
                joinedRef.current = true;
              }
            }
            break;
          case "ping_update":
            setUsers((current) =>
              current.map((user) =>
                user.userId === message.payload.userId
                  ? { ...user, ping: message.payload.ping }
                  : user,
              ),
            );
            break;
          case "user_joined":
          case "user_left":
            break;
          case "pong": {
            const rtt = Date.now() - message.payload.t;
            if (rtt > 0) {
              samplesRef.current = [...samplesRef.current, rtt].slice(-PING_SAMPLE_SIZE);
              reportPing();
            }
            break;
          }
          case "error":
            setError(message.payload.message);
            break;
        }
      });

      socket.addEventListener("close", () => {
        setConnected(false);
        socketRef.current = null;
        if (!cancelled) {
          reconnectTimerRef.current = window.setTimeout(connect, 1500);
        }
      });

      socket.addEventListener("error", () => {
        setConnected(false);
      });
    };

    connect();

    pingTimerRef.current = window.setInterval(() => {
      send({ type: "ping", payload: { t: Date.now() } });
    }, PING_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [clientId, enabled, reportPing, send, sessionId, userName]);

  return { users, connected, error, selfUserId };
}
