import { useEffect, useRef, useState } from "react";
import { computeCombinedPing, computeRodAngleDegrees, findBestHost, type PingMatrix, type User } from "@lag-dowsing-rod/shared";

/**
 * Minimum time spent "sampling" before the host can be revealed, even if
 * real measurements come back faster than this. Gives the build-up its own
 * pace instead of snapping to an answer the instant data allows it.
 */
const MIN_SAMPLING_MS = 4500;
/** How long the jackpot flourish (rod snap, burst, banner) stays active. */
const REVEAL_FLOURISH_MS = 1200;

export type RevealPhase = "solo" | "sampling" | "revealed";

export interface HostRevealState {
  phase: RevealPhase;
  bestHost: User | null;
  /** Degrees the rod should point to. Only meaningful outside "sampling" — while sampling the rod runs its own searching animation instead. */
  rodAngleDegrees: number;
  /** True for a brief window right after the host is first revealed (or re-revealed after new data invalidated the pick) — drives the jackpot animation. */
  justRevealed: boolean;
}

/**
 * Turns "who should host" from an instant answer into a brief build-up
 * followed by a one-time reveal, so joining a session with others feels
 * like a sampling process rather than an instant lookup. Solo sessions
 * skip the ceremony entirely — there's no one to build suspense about yet.
 */
export function useHostReveal(users: User[], pingMatrix: PingMatrix): HostRevealState {
  const [revealed, setRevealed] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);
  const samplingStartRef = useRef<number | null>(null);
  const wasReadyRef = useRef(false);
  const flourishTimerRef = useRef<number | null>(null);

  const bestHost = findBestHost(users, pingMatrix);
  const dataReady =
    users.length <= 1 || users.every((user) => computeCombinedPing(user, users, pingMatrix) !== null);

  useEffect(() => {
    if (users.length <= 1) {
      setRevealed(false);
      samplingStartRef.current = null;
      wasReadyRef.current = dataReady;
      return;
    }

    const enteringSampling = samplingStartRef.current === null || (wasReadyRef.current && !dataReady);
    if (enteringSampling) {
      samplingStartRef.current = Date.now();
      setRevealed(false);
    }
    wasReadyRef.current = dataReady;

    if (!dataReady) return;

    const elapsed = Date.now() - (samplingStartRef.current ?? Date.now());
    const remaining = Math.max(0, MIN_SAMPLING_MS - elapsed);

    const timer = window.setTimeout(() => {
      setRevealed(true);
      setJustRevealed(true);
      if (flourishTimerRef.current) window.clearTimeout(flourishTimerRef.current);
      flourishTimerRef.current = window.setTimeout(() => setJustRevealed(false), REVEAL_FLOURISH_MS);
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [users.length, dataReady]);

  useEffect(() => {
    return () => {
      if (flourishTimerRef.current) window.clearTimeout(flourishTimerRef.current);
    };
  }, []);

  const phase: RevealPhase = users.length <= 1 ? "solo" : revealed ? "revealed" : "sampling";

  return {
    phase,
    bestHost,
    rodAngleDegrees: computeRodAngleDegrees(users, pingMatrix),
    justRevealed: phase === "revealed" && justRevealed,
  };
}
