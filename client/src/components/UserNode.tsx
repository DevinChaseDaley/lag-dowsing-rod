import type { User } from "@lag-dowsing-rod/shared";

interface UserNodeProps {
  user: User;
  x: number;
  y: number;
  combinedPing: number | null;
  isBestHost: boolean;
  justRevealed: boolean;
}

export function UserNode({ user, x, y, combinedPing, isBestHost, justRevealed }: UserNodeProps) {
  const pingLabel = user.ping === null ? "signal …" : `signal ${user.ping}ms`;
  const combinedLabel = combinedPing === null ? "measuring…" : `${combinedPing}ms combined`;
  const circleClass = isBestHost ? "userNodeCircle userNodeCircleHost" : "userNodeCircle";
  const celebrating = isBestHost && justRevealed;

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
            y={-44}
            textAnchor="middle"
            className="userNodeHostBadge"
            style={celebrating ? { animation: "badgeFadeIn 420ms 200ms both" } : undefined}
          >
            HOST
          </text>
        ) : null}
        <text y={-30} textAnchor="middle" className="userNodeName">
          {user.userName}
        </text>
        <text y={36} textAnchor="middle" className="userNodePing">
          {pingLabel}
        </text>
        <text y={50} textAnchor="middle" className="userNodeCombined">
          {combinedLabel}
        </text>
      </g>
    </g>
  );
}
