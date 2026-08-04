# Lag Dowsing Rod

A real-time web app that helps a group figure out who should host their gaming session. Participants join a shared session, take fixed positions on a wheel, and a center dowsing rod swings to point at whoever would give the group the **lowest combined ping** — the best-positioned host.

## How it works

1. Create a session and share the link or 6-character code.
2. Participants join with a display name (guest mode, no accounts).
3. Every pair of browsers opens a direct **WebRTC data channel** to each other — the session server only relays the SDP/ICE handshake to get that connection started, it never sits in the path afterward.
4. Each pair measures real round-trip latency directly between themselves, every 2 seconds, smoothed with a rolling average of the last 5 samples.
5. For each participant, the app totals their measured latency to every other participant into a **combined ping** — the real cost the group would pay if that person hosted.
6. The dowsing rod points at the participant with the lowest combined ping, and the participant list ranks everyone from best to worst host candidate.

The session server also tracks each browser's ping to itself, shown as a small "signal" reading next to each name — that's just a connectivity indicator for the server, not part of the host math. See [Real peer-to-peer measurement](#real-peer-to-peer-measurement-webrtc) for why hosting can live on a participant's own machine once you're measuring this way.

## Monorepo layout

```
lag_dowsing_rod/
├── client/   React + Vite frontend
├── server/   Fastify + WebSocket session/signaling server
└── shared/   Types and rod math
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

The client talks to the server directly at `VITE_API_URL` (defaults to `http://localhost:3001`) — see `client/.env.example`.

### Real peer-to-peer measurement (WebRTC)

The session server (`server/`) never sees game traffic and never measures pairwise latency itself — it's a thin **signaling relay**: participants send it SDP offers/answers and ICE candidates addressed to a specific `userId`, and it forwards each one to that participant's socket unread (`webrtc_signal` messages). Once a data channel is open between two browsers, they ping each other directly and each side reports its own measured RTT back to the server (`peer_ping_report`), which the server folds into the session's `PingMatrix` and broadcasts to everyone (`peer_ping_update`, and the full matrix on every `session_state`) so all clients compute the same host recommendation from the same data.

Two consequences fall out of this:

- **Hosting moves to a participant's machine, not the app's server.** The server's job is bookkeeping (who's in the session, relaying signals) — once the group knows who the best host is, that person's own machine is where the game itself should run. For a browser-based game this app's own data channels could carry gameplay traffic directly; for a native game server (Minecraft, Valheim, etc.) the recommended host still needs to open the real game port themselves (a small local helper handling UPnP/NAT-PMP is a natural next step, but is out of scope for this app). This is also why there's no per-region server provisioning here: since combined ping is measured directly between participants rather than as distance to this server, the server's own region doesn't affect host-recommendation accuracy — a single always-on instance is all the app needs.
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

There are two deployables: the static frontend and the always-on session/signaling server.

### Server

The root `Dockerfile` builds the server (`server/` + `shared/`):

```bash
npm run build -w shared
npm run build -w server
npm run start -w server
```

`fly.toml` deploys it as a single always-on Fly app (`internal_port = 3001`) — adjust the `app` name to match whatever you've already provisioned, or deploy it anywhere else that can run a long-lived Node process and accept WebSocket connections.

### Frontend

Build and deploy `client/dist` to any static host (Vercel, Netlify, Cloudflare Pages), with `VITE_API_URL` set to the deployed server's URL:

```bash
npm run build -w shared
npm run build -w client
```

The client talks to the server directly, cross-origin — no `/api`/`/ws` proxy config is needed on the frontend host itself.

## Protocol summary

### REST — game server

- `POST /api/sessions` → `{ sessionId }`
- `GET /api/sessions/:id` → session existence check
- `GET /api/status` → `{ activeSessions }`

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
