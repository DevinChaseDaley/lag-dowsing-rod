import type { User } from "@lag-dowsing-rod/shared";

interface UserNodeProps {
  user: User;
  x: number;
  y: number;
}

export function UserNode({ user, x, y }: UserNodeProps) {
  const pingLabel = user.ping === null ? "…" : `${user.ping}ms`;

  return (
    <g transform={`translate(${x} ${y})`} className="userNode">
      <circle r={22} className="userNodeCircle" />
      <text y={-30} textAnchor="middle" className="userNodeName">
        {user.userName}
      </text>
      <text y={36} textAnchor="middle" className="userNodePing">
        {pingLabel}
      </text>
    </g>
  );
}
