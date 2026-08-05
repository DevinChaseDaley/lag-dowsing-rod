import type { CSSProperties } from "react";

interface DowsingRodProps {
  center: number;
  length: number;
  /** null while sampling — the rod runs its own searching animation instead of pointing anywhere in particular. */
  angleDegrees: number | null;
  /** Plays a longer, overshooting "lock-in" transition for the moment the host is revealed. */
  justRevealed: boolean;
}

const FORK_SPAN = 20;
const FORK_LENGTH = 34;

export function DowsingRod({ center, length, angleDegrees, justRevealed }: DowsingRodProps) {
  const searching = angleDegrees === null;
  const rotation = (angleDegrees ?? 0) + 90;
  const forkPath = `M ${-FORK_SPAN} 2 L 0 ${-FORK_LENGTH} L ${FORK_SPAN} 2`;

  const rotationStyle: CSSProperties = searching
    ? { animation: "rodSearch 2.4s linear infinite" }
    : {
        transform: `rotate(${rotation}deg)`,
        transition: justRevealed
          ? "transform 900ms cubic-bezier(0.34, 1.56, 0.64, 1)"
          : "transform 300ms ease-out",
      };

  return (
    <g transform={`translate(${center} ${center})`}>
      <g style={rotationStyle}>
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
      </g>
      <circle cx={0} cy={0} r={9} fill="var(--rod-pivot)" stroke="var(--rod-shadow)" strokeWidth={1.5} />
    </g>
  );
}
