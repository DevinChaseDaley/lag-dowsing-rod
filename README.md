# Lag Dowsing Rod

A real-time web app where participants join a shared session, take fixed positions on a wheel, and a center dowsing rod rotates toward the **ping-weighted centroid** of the room. Higher latency pulls the rod more strongly toward that participant.

## How it works

1. Create a session and share the link or 6-character code.
2. Participants join with a display name (guest mode, no accounts).
3. Each browser measures round-trip latency to the session server every 2 seconds.
4. Ping values are smoothed with a rolling average of the last 5 samples.
5. The dowsing rod points toward the weighted vector sum of participant positions, using ping as weight.

## Monorepo layout

```
lag_dowsing_rod/
├── client/   React + Vite frontend
├── server/   Fastify + WebSocket backend
└── shared/   Types and rod math utilities
```

## Requirements

- Node.js 20+
- npm 10+

## Development

Install dependencies and start both apps:

```bash
npm install
npm run build -w shared
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api
- WebSocket: ws://localhost:3001/ws

The Vite dev server proxies `/api` and `/ws` to the backend.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run server and client together |
| `npm run build` | Build shared, server, and client |
| `npm test` | Run shared unit tests |

## Manual test

1. Start the dev servers.
2. Create a session in one tab.
3. Open the copied link in two or more additional tabs with different names.
4. Throttle network speed in DevTools for one tab.
5. Confirm the rod swings toward the throttled participant as their ping rises.

## Deployment notes

This project uses a static frontend plus a WebSocket-capable backend.

### Backend

Deploy `server/` to a host that supports long-lived WebSocket connections (Railway, Fly.io, Render, etc.).

```bash
npm run build -w shared
npm run build -w server
npm run start -w server
```

Set `PORT` if your host requires it.

### Frontend

Build and deploy `client/dist` to any static host (Vercel, Netlify, Cloudflare Pages).

```bash
npm run build -w shared
npm run build -w client
```

Configure your static host to:

- Proxy `/api/*` to the backend origin
- Proxy `/ws` as a WebSocket upgrade to the backend origin

If the frontend and backend are on different domains, update the client WebSocket URL logic in `client/src/lib/sessionApi.ts` to point at the deployed backend.

## Protocol summary

### REST

- `POST /api/sessions` → `{ sessionId }`
- `GET /api/sessions/:id` → session existence check

### WebSocket messages

All messages use `{ type, payload }`.

- Client → server: `join`, `ping`, `ping_report`
- Server → client: `session_state`, `pong`, `user_joined`, `user_left`, `ping_update`, `error`

## Defaults

- Max users per session: 12
- Ping interval: 2 seconds
- Ping smoothing: rolling average of 5 samples
- Session TTL: 24 hours of inactivity
