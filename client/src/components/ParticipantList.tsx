import type { User } from "@lag-dowsing-rod/shared";
import styles from "./ParticipantList.module.css";

interface ParticipantListProps {
  users: User[];
  selfUserId: string | null;
}

export function ParticipantList({ users, selfUserId }: ParticipantListProps) {
  if (users.length === 0) {
    return (
      <section className={styles.panel}>
        <h2>Participants</h2>
        <p className={styles.empty}>No one has joined yet.</p>
      </section>
    );
  }

  const sorted = [...users].sort((a, b) => (b.ping ?? -1) - (a.ping ?? -1));

  return (
    <section className={styles.panel}>
      <h2>Participants</h2>
      <ul className={styles.list}>
        {sorted.map((user) => (
          <li key={user.userId} className={user.userId === selfUserId ? styles.self : undefined}>
            <span className={styles.name}>{user.userName}</span>
            <span className={styles.ping}>{user.ping === null ? "measuring…" : `${user.ping} ms`}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
