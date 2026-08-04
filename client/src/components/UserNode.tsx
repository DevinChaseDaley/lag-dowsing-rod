import type { User } from "@lag-dowsing-rod/shared";

interface UserNodeProps {
  user: User;
  x: number;
  y: number;
  combinedPing: number | null;
  isBestHost: boolean;
  justRevealed: boolean;
  /** True on narrow phone screens — bumps text sizes so they don't shrink into illegibility along with the wheel's smaller rendered width. */
  compact: boolean;
}

export function UserNode({ user, x, y, combinedPing, isBestHost, justRevealed, compact }: UserNodeProps) {
  const pingLabel = user.ping === null ? "signal …" : `signal ${user.ping}ms`;
  const combinedLabel = combinedPing === null ? "measuring…" : `${combinedPing}ms combined`;
  const circleClass = isBestHost ? "userNodeCircle userNodeCircleHost" : "userNodeCircle";
  const celebrating = isBestHost && justRevealed;

  const hostBadgeClass = compact ? "userNodeHostBadge userNodeHostBadgeCompact" : "userNodeHostBadge";
  const nameClass = compact ? "userNodeName userNodeNameCompact" : "userNodeName";
  const pingClass = compact ? "userNodePing userNodePingCompact" : "userNodePing";
  const combinedClass = compact ? "userNodeCombined userNodeCombinedCompact" : "userNodeCombined";

  const hostBadgeY = compact ? -50 : -44;
  const nameY = compact ? -32 : -30;
  const pingY = compact ? 40 : 36;
  const combinedY = compact ? 58 : 50;

  return (
    <g transform={`translate(${x} ${y})`} className="userNode">
      {celebrating ? (
        <>
          <circle r={22} className="hostBurstRing" style={{ animationDelay: "0ms" }} />
          <circle r={22} className="hostBurstRing" style={{ animationDelay: "180ms" }} />
          <circle r={22} className="hostBurstRing" style={{ animationDelay: "360ms" }} />
        </>
      ) : null}
      <g style={celebrating ? { animation: "hostPop 650ms cubic-bezier(0.34, 1.56, 0.64, 1)" } : undefined}>
        <circle r={22} className={circleClass} />
        {isBestHost ? (
          <text
            y={hostBadgeY}
            textAnchor="middle"
            className={hostBadgeClass}
            style={celebrating ? { animation: "badgeFadeIn 420ms 200ms both" } : undefined}
          >
            HOST
          </text>
        ) : null}
        <text y={nameY} textAnchor="middle" className={nameClass}>
          {user.userName}
        </text>
        <text y={pingY} textAnchor="middle" className={pingClass}>
          {pingLabel}
        </text>
        <text y={combinedY} textAnchor="middle" className={combinedClass}>
          {combinedLabel}
        </text>
      </g>
    </g>
  );
}
