import type { User } from "@lag-dowsing-rod/shared";

interface UserNodeProps {
  user: User;
  x: number;
  y: number;
  combinedPing: number | null;
  isBestHost: boolean;
}

export function UserNode({ user, x, y, combinedPing, isBestHost }: UserNodeProps) {
  const pingLabel = user.ping === null ? "signal …" : `signal ${user.ping}ms`;
  const combinedLabel = combinedPing === null ? "measuring…" : `${combinedPing}ms combined`;
  const circleClass = isBestHost ? "userNodeCircle userNodeCircleHost" : "userNodeCircle";

  return (
    <g transform={`translate(${x} ${y})`} className="userNode">
      <circle r={22} className={circleClass} />
      {isBestHost ? (
        <text y={-44} textAnchor="middle" className="userNodeHostBadge">
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
  );
}
