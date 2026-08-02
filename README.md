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
├── client/         React + Vite frontend
├── control-plane/  Fastify service that provisions a game server per region
├── server/         Fastify + WebSocket game server
└── shared/         Types, rod math, and the region table
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

### Control plane (dynamic regional hosting)

`control-plane/` is a separate always-on service that provisions a game-server instance in the region closest to wherever the game session is (see `shared/src/regions.ts` for the LoL platform → region table), and tells clients which host to talk to — so latency measured in-app reflects real network conditions instead of distance to one fixed server. `npm run dev` starts it alongside the client and server on port 4000.

With no `FLY_API_TOKEN` set, it falls back to routing every region to the local game server at `localhost:3001`, so the full create-session → resolve-host → connect flow works in local dev without any Fly account. See `control-plane/.env.example` for the Fly-related variables (`FLY_API_TOKEN`, `FLY_APP_PREFIX`, `FLY_ORG_SLUG`, `GAME_SERVER_IMAGE_REF`) needed for real regional provisioning, and `client/.env.example` for `VITE_CONTROL_PLANE_URL`.

### Docker

Run the full stack with Docker Compose:

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api
- WebSocket: ws://localhost:3001/ws

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

There are three deployables: the static frontend, the always-on control plane, and the game server image the control plane provisions per region.

### Game server (per region, provisioned dynamically)

The root `Dockerfile` builds the game-server image (`server/` + `shared/`), unchanged from before the control plane existed — it still just runs `server/`:

```bash
npm run build -w shared
npm run build -w server
npm run start -w server
```

For dynamic regional hosting, push this image to Fly's registry once; the control plane creates one Fly Machine per region from it on demand (see `control-plane/src/machinesClient.ts`). It can still be deployed as a single fixed instance instead, same as before — the control plane is optional.

### Control plane

Deploy `control-plane/` (its own `Dockerfile`) as a single always-on service — it doesn't need to be region-specific itself, since it only provisions and routes to game-server machines. Set the `FLY_*` variables from `control-plane/.env.example` so it can reach the Fly Machines API.

### Frontend

Build and deploy `client/dist` to any static host (Vercel, Netlify, Cloudflare Pages), with `VITE_CONTROL_PLANE_URL` set to the deployed control plane's URL:

```bash
npm run build -w shared
npm run build -w client
```

The client talks to the control plane and to whichever game-server host it's handed — both cross-origin, not proxied through the static host — so no `/api`/`/ws` proxy config is needed on the frontend host itself.

## Protocol summary

### REST — control plane

- `POST /control/sessions` `{ region | platform }` → `{ sessionId, host, protocol }`, provisioning or reusing a region's machine
- `GET /control/sessions/:id` → `{ host, protocol }` for a session created elsewhere (shared-link lookup)

### REST — game server

- `POST /api/sessions` → `{ sessionId }`
- `GET /api/sessions/:id` → session existence check
- `GET /api/status` → `{ activeSessions }`, polled by the control plane's idle sweep

### WebSocket messages

All messages use `{ type, payload }`.

- Client → server: `join`, `ping`, `ping_report`
- Server → client: `session_state`, `pong`, `user_joined`, `user_left`, `ping_update`, `error`

## Defaults

- Max users per session: 12
- Ping interval: 2 seconds
- Ping smoothing: rolling average of 5 samples
- Session TTL: 24 hours of inactivity
