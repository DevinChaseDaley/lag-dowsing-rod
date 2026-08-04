import { computeCombinedPing, type PingMatrix, type User } from "@lag-dowsing-rod/shared";
import type { HostRevealState } from "../hooks/useHostReveal";
import styles from "./ParticipantList.module.css";

interface ParticipantListProps {
  users: User[];
  pingMatrix: PingMatrix;
  reveal: HostRevealState;
  selfUserId: string | null;
}

export function ParticipantList({ users, pingMatrix, reveal, selfUserId }: ParticipantListProps) {
  if (users.length === 0) {
    return (
      <section className={styles.panel}>
        <h2>Who should host?</h2>
        <p className={styles.empty}>No one has joined yet.</p>
      </section>
    );
  }

  const sampling = reveal.phase === "sampling";
  const ranked = users
    .map((user) => ({ user, combinedPing: computeCombinedPing(user, users, pingMatrix) }))
    .sort((a, b) => (a.combinedPing ?? Infinity) - (b.combinedPing ?? Infinity));

  return (
    <section className={styles.panel}>
      <h2>Who should host?</h2>
      <ul className={styles.list}>
        {ranked.map(({ user, combinedPing }, index) => (
          <li
            key={user.userId}
            className={user.userId === selfUserId ? styles.self : undefined}
            style={reveal.justRevealed ? { animation: `itemAppear 420ms ease-out ${index * 90}ms both` } : undefined}
          >
            <span className={styles.name}>
              {user.userName}
              {!sampling && reveal.bestHost?.userId === user.userId ? (
                <span className={styles.hostBadge}>Best host</span>
              ) : null}
            </span>
            <span className={styles.ping}>
              {combinedPing === null ? "measuring…" : `${combinedPing} ms combined`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
