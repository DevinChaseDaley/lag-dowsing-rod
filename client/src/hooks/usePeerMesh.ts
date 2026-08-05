import { useCallback, useEffect, useRef } from "react";
import { PING_INTERVAL_MS, PING_SAMPLE_SIZE, rollingAverage, type WebRTCSignal } from "@lag-dowsing-rod/shared";
import { getIceServers } from "../lib/webrtcConfig";

type ChannelMessage = { type: "ping"; t: number } | { type: "pong"; t: number };

interface SignalPayload {
  kind: "offer" | "answer" | "ice-candidate";
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

interface PeerConnState {
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  samples: number[];
  pendingCandidates: RTCIceCandidateInit[];
}

interface UsePeerMeshOptions {
  /** This participant's own userId, once known — the mesh stays idle until then. */
  selfUserId: string | null;
  /** Every userId currently in the session, including our own. */
  peerIds: string[];
  /** Send a signaling payload to another participant, relayed through the session server. */
  onSignal: (targetUserId: string, signal: WebRTCSignal) => void;
  /** A fresh rolling-average RTT measurement to a peer, ready to report upstream. */
  onPeerPing: (peerUserId: string, ping: number) => void;
}

interface UsePeerMeshResult {
  /** Feed an incoming signaling payload from another participant into the mesh. */
  handleSignal: (fromUserId: string, signal: WebRTCSignal) => void;
}

/**
 * Maintains a full mesh of direct WebRTC connections to every other
 * participant in the session and measures real round-trip latency to each
 * of them over a data channel — the peer-to-peer replacement for pinging a
 * single shared server. To avoid both sides racing to open a connection,
 * only the lexicographically lower userId initiates the offer; the other
 * side answers once it arrives.
 */
export function usePeerMesh({ selfUserId, peerIds, onSignal, onPeerPing }: UsePeerMeshOptions): UsePeerMeshResult {
  const peersRef = useRef<Map<string, PeerConnState>>(new Map());
  const onSignalRef = useRef(onSignal);
  const onPeerPingRef = useRef(onPeerPing);

  onSignalRef.current = onSignal;
  onPeerPingRef.current = onPeerPing;

  const setupChannel = useCallback((peerId: string, peer: PeerConnState, channel: RTCDataChannel) => {
    peer.channel = channel;

    channel.addEventListener("message", (event) => {
      let message: ChannelMessage;
      try {
        message = JSON.parse(String(event.data)) as ChannelMessage;
      } catch {
        return;
      }

      if (message.type === "ping") {
        channel.send(JSON.stringify({ type: "pong", t: message.t }));
        return;
      }

      const rtt = Date.now() - message.t;
      if (rtt <= 0) return;

      peer.samples = [...peer.samples, rtt].slice(-PING_SAMPLE_SIZE);
      const average = rollingAverage(peer.samples, PING_SAMPLE_SIZE);
      if (average !== null) {
        onPeerPingRef.current(peerId, average);
      }
    });
  }, []);

  const getOrCreatePeer = useCallback(
    (peerId: string, isInitiator: boolean): PeerConnState => {
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      const peer: PeerConnState = { pc, channel: null, samples: [], pendingCandidates: [] };
      peersRef.current.set(peerId, peer);

      pc.addEventListener("icecandidate", (event) => {
        if (event.candidate) {
          onSignalRef.current(peerId, { kind: "ice-candidate", candidate: event.candidate.toJSON() });
        }
      });

      pc.addEventListener("datachannel", (event) => {
        setupChannel(peerId, peer, event.channel);
      });

      if (isInitiator) {
        const channel = pc.createDataChannel("ping");
        setupChannel(peerId, peer, channel);

        void pc
          .createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (pc.localDescription) {
              onSignalRef.current(peerId, { kind: "offer", sdp: pc.localDescription.sdp });
            }
          });
      }

      return peer;
    },
    [setupChannel],
  );

  const handleSignal = useCallback(
    (fromUserId: string, signal: WebRTCSignal) => {
      const payload = signal as SignalPayload;
      const peer = getOrCreatePeer(fromUserId, false);

      void (async () => {
        if (payload.kind === "offer" && payload.sdp) {
          await peer.pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
          await flushPendingCandidates(peer);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          if (peer.pc.localDescription) {
            onSignalRef.current(fromUserId, { kind: "answer", sdp: peer.pc.localDescription.sdp });
          }
        } else if (payload.kind === "answer" && payload.sdp) {
          await peer.pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
          await flushPendingCandidates(peer);
        } else if (payload.kind === "ice-candidate" && payload.candidate) {
          if (peer.pc.remoteDescription) {
            await peer.pc.addIceCandidate(payload.candidate);
          } else {
            peer.pendingCandidates.push(payload.candidate);
          }
        }
      })();
    },
    [getOrCreatePeer],
  );

  useEffect(() => {
    if (!selfUserId) return;

    const desired = new Set(peerIds.filter((id) => id !== selfUserId));

    for (const peerId of desired) {
      if (!peersRef.current.has(peerId) && selfUserId < peerId) {
        getOrCreatePeer(peerId, true);
      }
    }

    for (const [peerId, peer] of peersRef.current.entries()) {
      if (!desired.has(peerId)) {
        peer.pc.close();
        peersRef.current.delete(peerId);
      }
    }
  }, [peerIds, selfUserId, getOrCreatePeer]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      for (const peer of peersRef.current.values()) {
        if (peer.channel?.readyState === "open") {
          peer.channel.send(JSON.stringify({ type: "ping", t: Date.now() }));
        }
      }
    }, PING_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const peers = peersRef.current;
    return () => {
      for (const peer of peers.values()) {
        peer.pc.close();
      }
      peers.clear();
    };
  }, []);

  return { handleSignal };
}

async function flushPendingCandidates(peer: PeerConnState): Promise<void> {
  const candidates = peer.pendingCandidates.splice(0);
  for (const candidate of candidates) {
    await peer.pc.addIceCandidate(candidate);
  }
}
