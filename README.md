# Lag Dowsing Rod

A real-time web app that helps a group figure out who should host their gaming session. Participants join a shared session, take fixed positions on a wheel, and a center dowsing rod swings to point at whoever would give the group the **lowest combined ping** — the best-positioned host.

## How it works

1. Create a session and share the link or 6-character code.
2. Participants join with a display name (guest mode, no accounts).
3. Every pair of browsers opens a direct **WebRTC data channel** to each other — the session server only relays the SDP/ICE handshake to get that connection started, it never sits in the path afterward.
4. Each pair measures real round-trip latency directly between themselves, every 2 seconds, smoothed with a rolling average of the last 5 samples.
5. For each participant, the app totals their measured latency to every other participant into a **combined ping** — the real cost the group would pay if that person hosted.
6. The dowsing rod points at the participant with the lowest combined ping, and the participant list ranks everyone from best to worst host candidate.

The session server also tracks each browser's ping to itself, shown as a small "signal" reading next to each name — that's just a connectivity indicator for the coordinator, not part of the host math anymore. See [Real peer-to-peer measurement](#real-peer-to-peer-measurement-webrtc) for why hosting can no longer live on a single shared server once you're measuring this way.

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

Now that combined ping is measured over real peer-to-peer connections rather than distance to this server, the game server's own region no longer affects host-recommendation accuracy — it only affects how snappy the WebSocket signaling itself feels. Regional provisioning is kept because it's still a reasonable way to keep that signaling connection close to the group, but a single always-on instance works just as well for the app's core purpose.

### Real peer-to-peer measurement (WebRTC)

The session server (`server/`) never sees game traffic and never measures pairwise latency itself — it's a thin **signaling relay**: participants send it SDP offers/answers and ICE candidates addressed to a specific `userId`, and it forwards each one to that participant's socket unread (`webrtc_signal` messages). Once a data channel is open between two browsers, they ping each other directly and each side reports its own measured RTT back to the server (`peer_ping_report`), which the server folds into the session's `PingMatrix` and broadcasts to everyone (`peer_ping_update`, and the full matrix on every `session_state`) so all clients compute the same host recommendation from the same data.

Two consequences fall out of this:

- **Hosting moves to a participant's machine, not the app's server.** The server's job shrinks to bookkeeping (who's in the session, relaying signals) — once the group knows who the best host is, that person's own machine is where the game itself should run. For a browser-based game this app's own data channels could carry gameplay traffic directly; for a native game server (Minecraft, Valheim, etc.) the recommended host still needs to open the real game port themselves (a small local helper handling UPnP/NAT-PMP is a natural next step, but is out of scope for this app).
- **NAT traversal needs STUN.** Each browser needs to discover its public address to negotiate a direct connection; that's what the `VITE_STUN_URLS` client env var configures (defaults to public Google STUN servers — see `client/.env.example`). STUN servers never see ping or game data, only the address-discovery handshake. Symmetric NATs that STUN alone can't traverse will fail to connect a given pair — there's no TURN relay fallback here, so those participants simply won't get a combined-ping reading for each other yet.

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
4. Watch each participant's "combined" reading resolve from "measuring…" to a number within a few seconds — that's the WebRTC mesh finishing negotiation and reporting its first real RTT samples.
5. Throttle network speed in DevTools for one tab (Network conditions → a specific tab's connection, not global, so the throttling is asymmetric between participants).
6. Confirm the rod swings away from the throttled participant, toward whichever remaining participant now has the lowest combined ping, and that the participant list's "Best host" badge tracks the same participant.

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

- Client → server: `join`, `ping`, `ping_report`, `webrtc_signal`, `peer_ping_report`
- Server → client: `session_state`, `pong`, `user_joined`, `user_left`, `ping_update`, `webrtc_signal`, `peer_ping_update`, `error`

`webrtc_signal` carries an opaque SDP offer/answer or ICE candidate addressed to a `targetUserId`; the server relays it without inspecting it. `peer_ping_report`/`peer_ping_update` carry one participant's measured round-trip latency to another, straight from their WebRTC data channel — see [Real peer-to-peer measurement](#real-peer-to-peer-measurement-webrtc).

## Defaults

- Max users per session: 12
- Ping interval: 2 seconds (both the signaling-server ping and each peer-to-peer data channel ping)
- Ping smoothing: rolling average of 5 samples
- Session TTL: 24 hours of inactivity
- STUN servers: public Google STUN by default, override with `VITE_STUN_URLS` (see `client/.env.example`)
