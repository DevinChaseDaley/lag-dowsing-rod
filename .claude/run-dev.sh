#!/bin/sh
# Dev launcher for tools that inject a PORT env var matching the preview port
# (e.g. Claude Code's browser preview) — unset it so the server (3001) and
# control-plane (4000) don't fight the client (5173) for the same port.
unset PORT
cd "$(dirname "$0")/.."
exec npm run dev
