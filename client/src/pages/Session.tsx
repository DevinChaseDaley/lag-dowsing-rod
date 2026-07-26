import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Wheel } from "../components/Wheel";
import { useSessionSocket } from "../hooks/useSessionSocket";
import {
  getClientId,
  getSessionShareUrl,
  getStoredUserName,
  storeUserName,
  validateSession,
} from "../lib/sessionApi";
import styles from "./Session.module.css";

export function Session() {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const normalizedSessionId = sessionId.toUpperCase();

  const [userName, setUserName] = useState(getStoredUserName());
  const [joined, setJoined] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const clientId = useMemo(
    () => (normalizedSessionId ? getClientId(normalizedSessionId) : ""),
    [normalizedSessionId],
  );

  const { users, connected, error } = useSessionSocket({
    sessionId: normalizedSessionId,
    userName,
    clientId,
    enabled: joined && sessionValid,
  });

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      if (!normalizedSessionId) {
        navigate("/");
        return;
      }

      setCheckingSession(true);
      const exists = await validateSession(normalizedSessionId);
      if (cancelled) return;

      if (!exists) {
        navigate("/");
        return;
      }

      setSessionValid(true);
      setCheckingSession(false);

      const storedName = getStoredUserName();
      if (storedName) {
        setUserName(storedName);
        setJoined(true);
      }
    }

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [navigate, normalizedSessionId]);

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!userName.trim()) {
      setJoinError("Enter a display name to join.");
      return;
    }
    storeUserName(userName);
    setJoinError(null);
    setJoined(true);
  };

  const handleCopyLink = async () => {
    const url = getSessionShareUrl(normalizedSessionId);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (checkingSession) {
    return (
      <main className={styles.page}>
        <p className={styles.status}>Loading session…</p>
      </main>
    );
  }

  if (!joined) {
    return (
      <main className={styles.page}>
        <section className={styles.joinCard}>
          <p className={styles.codeLabel}>Session {normalizedSessionId}</p>
          <h1>Join the wheel</h1>
          <form onSubmit={handleJoin} className={styles.joinForm}>
            <label className={styles.field}>
              <span>Display name</span>
              <input
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
                placeholder="Your name"
                maxLength={24}
                autoFocus
              />
            </label>
            <button type="submit" className={styles.primary}>
              Enter session
            </button>
          </form>
          {joinError ? <p className={styles.error}>{joinError}</p> : null}
          <Link to="/" className={styles.backLink}>
            Back home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.codeLabel}>Session {normalizedSessionId}</p>
          <h1>Lag Dowsing Rod</h1>
        </div>
        <div className={styles.headerActions}>
          <span className={connected ? styles.online : styles.offline}>
            {connected ? "Connected" : "Reconnecting…"}
          </span>
          <button type="button" className={styles.copyButton} onClick={handleCopyLink}>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <Wheel users={users} />
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
    </main>
  );
}
