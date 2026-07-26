interface DowsingRodProps {
  angle: number;
  center: number;
  length: number;
}

export function DowsingRod({ angle, center, length }: DowsingRodProps) {
  const rotation = angle + 90;

  return (
    <g
      className="rodGroup"
      transform={`translate(${center} ${center}) rotate(${rotation})`}
      style={{ transition: "transform 300ms ease-out" }}
    >
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={-length}
        stroke="var(--rod-color)"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <line
        x1={-18}
        y1={-length + 12}
        x2={18}
        y2={-length + 12}
        stroke="var(--rod-color)"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <circle cx={0} cy={0} r={10} fill="var(--rod-pivot)" />
    </g>
  );
}
