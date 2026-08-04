interface DowsingRodProps {
  angle: number;
  center: number;
  length: number;
}

const FORK_SPAN = 20;
const FORK_LENGTH = 34;

export function DowsingRod({ angle, center, length }: DowsingRodProps) {
  const rotation = angle + 90;
  const forkPath = `M ${-FORK_SPAN} 2 L 0 ${-FORK_LENGTH} L ${FORK_SPAN} 2`;

  return (
    <g
      className="rodGroup"
      transform={`translate(${center} ${center}) rotate(${rotation})`}
      style={{ transition: "transform 300ms ease-out" }}
    >
      <path
        d={forkPath}
        fill="none"
        stroke="var(--rod-shadow)"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={0}
        y1={-FORK_LENGTH}
        x2={0}
        y2={-length}
        stroke="var(--rod-shadow)"
        strokeWidth={7}
        strokeLinecap="round"
      />
      <path
        d={forkPath}
        fill="none"
        stroke="var(--rod-color)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={0}
        y1={-FORK_LENGTH}
        x2={0}
        y2={-length}
        stroke="var(--rod-color)"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <circle cx={0} cy={-length} r={4} fill="var(--rod-color)" />
      <circle cx={0} cy={0} r={9} fill="var(--rod-pivot)" stroke="var(--rod-shadow)" strokeWidth={1.5} />
    </g>
  );
}
