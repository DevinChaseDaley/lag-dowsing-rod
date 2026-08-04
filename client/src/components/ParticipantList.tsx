import { computeCombinedPing, findBestHost, type PingMatrix, type User } from "@lag-dowsing-rod/shared";
import styles from "./ParticipantList.module.css";

interface ParticipantListProps {
  users: User[];
  pingMatrix: PingMatrix;
  selfUserId: string | null;
}

export function ParticipantList({ users, pingMatrix, selfUserId }: ParticipantListProps) {
  if (users.length === 0) {
    return (
      <section className={styles.panel}>
        <h2>Who should host?</h2>
        <p className={styles.empty}>No one has joined yet.</p>
      </section>
    );
  }

  const bestHost = findBestHost(users, pingMatrix);
  const ranked = users
    .map((user) => ({ user, combinedPing: computeCombinedPing(user, users, pingMatrix) }))
    .sort((a, b) => (a.combinedPing ?? Infinity) - (b.combinedPing ?? Infinity));

  return (
    <section className={styles.panel}>
      <h2>Who should host?</h2>
      <ul className={styles.list}>
        {ranked.map(({ user, combinedPing }) => (
          <li key={user.userId} className={user.userId === selfUserId ? styles.self : undefined}>
            <span className={styles.name}>
              {user.userName}
              {bestHost?.userId === user.userId ? (
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
