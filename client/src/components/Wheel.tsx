import {
  computeRodAngleDegrees,
  getTotalSlots,
  wheelPosition,
  type User,
} from "@lag-dowsing-rod/shared";
import { UserNode } from "./UserNode";
import { DowsingRod } from "./DowsingRod";
import styles from "./Wheel.module.css";

const WHEEL_SIZE = 420;
const RADIUS = 160;
const CENTER = WHEEL_SIZE / 2;

interface WheelProps {
  users: User[];
}

export function Wheel({ users }: WheelProps) {
  const totalSlots = getTotalSlots(users);
  const rodAngle = computeRodAngleDegrees(users);

  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.wheel}
        viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
        role="img"
        aria-label="Participant wheel with dowsing rod"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          className={styles.ring}
        />
        <circle cx={CENTER} cy={CENTER} r={8} className={styles.pivot} />
        <DowsingRod angle={rodAngle} center={CENTER} length={RADIUS - 24} />
        {users.map((user) => {
          const position = wheelPosition(user.slotIndex, totalSlots, RADIUS);
          const x = CENTER + position.x;
          const y = CENTER + position.y;
          return <UserNode key={user.userId} user={user} x={x} y={y} />;
        })}
      </svg>
      {users.length === 0 ? (
        <p className={styles.empty}>Waiting for participants…</p>
      ) : null}
    </div>
  );
}
