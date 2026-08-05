const DEFAULT_STUN_URLS = "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302";

/**
 * STUN servers used only to discover each browser's public address for ICE
 * negotiation — no game or ping traffic ever passes through them. Override
 * with a comma-separated list via VITE_STUN_URLS for self-hosted deploys.
 */
export function getIceServers(): RTCIceServer[] {
  const raw: string = import.meta.env.VITE_STUN_URLS ?? DEFAULT_STUN_URLS;
  const urls = raw
    .split(",")
    .map((url: string) => url.trim())
    .filter(Boolean);

  return urls.length > 0 ? [{ urls }] : [];
}
