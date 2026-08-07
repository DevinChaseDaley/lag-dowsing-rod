import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createSession, getStoredUserName, sessionExists, storeUserName } from "../lib/sessionApi";
import styles from "./Home.module.css";

const SLOW_REQUEST_MS = 2500;

export function Home() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState(getStoredUserName());
  const [sessionCode, setSessionCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"create" | "join" | null>(null);
  const [slow, setSlow] = useState(false);
  const loading = pendingAction !== null;

  const withSlowNotice = async <T,>(action: () => Promise<T>): Promise<T> => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_REQUEST_MS);
    try {
      return await action();
    } finally {
      window.clearTimeout(timer);
      setSlow(false);
    }
  };

  const handleCreate = async () => {
    if (!userName.trim()) {
      setError("Enter a display name first.");
      return;
    }

    setPendingAction("create");
    setError(null);
    try {
      storeUserName(userName);
      const sessionId = await withSlowNotice(() => createSession());
      navigate(`/session/${sessionId}`);
    } catch {
      setError("Could not create a session. Try again.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (!userName.trim()) {
      setError("Enter a display name first.");
      return;
    }
    if (!sessionCode.trim()) {
      setError("Enter a session code.");
      return;
    }

    setPendingAction("join");
    setError(null);
    try {
      const normalized = sessionCode.trim().toUpperCase();
      const exists = await withSlowNotice(() => sessionExists(normalized));
      if (!exists) {
        setError("Session not found.");
        return;
      }
      storeUserName(userName);
      navigate(`/session/${normalized}`);
    } catch {
      setError("Could not join the session. Try again.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.eyebrow}>Who Should Host?</h1>
        <p className={styles.lede}>
          Join a session, take your place on the wheel, and watch the dowsing rod swing
          toward whoever gives the group the lowest combined ping.
        </p>
      </section>

      <section className={styles.card}>
        <label className={styles.field}>
          <span>Display name</span>
          <input
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            placeholder="Your name"
            maxLength={24}
            autoComplete="nickname"
          />
        </label>

        <button
          type="button"
          className={styles.primary}
          onClick={handleCreate}
          disabled={loading}
        >
          {pendingAction === "create" ? "Creating…" : "Create session"}
        </button>

        <div className={styles.divider}>or join existing</div>

        <form onSubmit={handleJoin} className={styles.joinForm}>
          <label className={styles.field}>
            <span>Session code</span>
            <input
              value={sessionCode}
              onChange={(event) => setSessionCode(event.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
            />
          </label>
          <button type="submit" className={styles.secondary} disabled={loading}>
            {pendingAction === "join" ? "Joining…" : "Join session"}
          </button>
        </form>

        {slow ? (
          <p className={styles.status}>Still working — the server may be waking up…</p>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    </main>
  );
}
