import { computeCombinedPing, getTotalSlots, wheelPosition, type PingMatrix, type User } from "@lag-dowsing-rod/shared";
import type { HostRevealState } from "../hooks/useHostReveal";
import { useIsCompact } from "../hooks/useIsCompact";
import { UserNode } from "./UserNode";
import { DowsingRod } from "./DowsingRod";
import styles from "./Wheel.module.css";

const WHEEL_SIZE = 420;
const RADIUS = 160;
const CENTER = WHEEL_SIZE / 2;
const TICK_COUNT = 24;
const TICK_INNER = RADIUS + 6;
const TICK_OUTER_MINOR = RADIUS + 12;
const TICK_OUTER_MAJOR = RADIUS + 20;

interface WheelProps {
  users: User[];
  pingMatrix: PingMatrix;
  reveal: HostRevealState;
}

function CompassTicks() {
  const ticks = [];
  for (let i = 0; i < TICK_COUNT; i += 1) {
    const isMajor = i % (TICK_COUNT / 4) === 0;
    const theta = (2 * Math.PI * i) / TICK_COUNT - Math.PI / 2;
    const outer = isMajor ? TICK_OUTER_MAJOR : TICK_OUTER_MINOR;
    const x1 = CENTER + TICK_INNER * Math.cos(theta);
    const y1 = CENTER + TICK_INNER * Math.sin(theta);
    const x2 = CENTER + outer * Math.cos(theta);
    const y2 = CENTER + outer * Math.sin(theta);
    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        className={isMajor ? styles.tickMajor : styles.tickMinor}
      />,
    );
  }
  return <g>{ticks}</g>;
}

export function Wheel({ users, pingMatrix, reveal }: WheelProps) {
  const totalSlots = getTotalSlots(users);
  const { phase, bestHost, rodAngleDegrees, justRevealed } = reveal;
  const sampling = phase === "sampling";
  const compact = useIsCompact();

  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.wheel}
        viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
        role="img"
        aria-label={
          sampling
            ? "Participant wheel with dowsing rod searching for the recommended host"
            : "Participant wheel with dowsing rod pointing at the recommended host"
        }
      >
        <CompassTicks />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          className={sampling ? `${styles.ring} ${styles.ringMeasuring}` : styles.ring}
        />
        <circle cx={CENTER} cy={CENTER} r={8} className={styles.pivot} />
        <DowsingRod
          center={CENTER}
          length={RADIUS}
          angleDegrees={sampling ? null : rodAngleDegrees}
          justRevealed={justRevealed}
        />
        {users.map((user) => {
          const position = wheelPosition(user.slotIndex, totalSlots, RADIUS);
          const x = CENTER + position.x;
          const y = CENTER + position.y;
          return (
            <UserNode
              key={user.userId}
              user={user}
              x={x}
              y={y}
              combinedPing={computeCombinedPing(user, users, pingMatrix)}
              isBestHost={!sampling && bestHost?.userId === user.userId}
              justRevealed={justRevealed}
              compact={compact}
            />
          );
        })}
      </svg>
      {users.length === 0 ? (
        <p className={styles.empty}>Waiting for participants…</p>
      ) : sampling ? (
        <p className={styles.empty}>Measuring connections…</p>
      ) : null}
    </div>
  );
}
