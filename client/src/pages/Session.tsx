import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ParticipantList } from "../components/ParticipantList";
import { Wheel } from "../components/Wheel";
import { useHostReveal } from "../hooks/useHostReveal";
import { useSessionSocket } from "../hooks/useSessionSocket";
import {
  getClientId,
  getSessionShareUrl,
  getStoredUserName,
  sessionExists,
  storeUserName,
} from "../lib/sessionApi";
import styles from "./Session.module.css";

export function Session() {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const normalizedSessionId = sessionId.toUpperCase();

  const [userName, setUserName] = useState(getStoredUserName());
  const [joined, setJoined] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [slowCheck, setSlowCheck] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const clientId = useMemo(
    () => (normalizedSessionId ? getClientId(normalizedSessionId) : ""),
    [normalizedSessionId],
  );

  const { users, pingMatrix, connected, error, selfUserId } = useSessionSocket({
    sessionId: normalizedSessionId,
    userName,
    clientId,
    enabled: joined,
  });

  const reveal = useHostReveal(users, pingMatrix);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      if (!normalizedSessionId) {
        navigate("/");
        return;
      }

      setCheckingSession(true);
      setSlowCheck(false);
      const slowTimer = window.setTimeout(() => setSlowCheck(true), 2500);
      const exists = await sessionExists(normalizedSessionId);
      window.clearTimeout(slowTimer);
      if (cancelled) return;

      if (!exists) {
        navigate("/");
        return;
      }

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
        {slowCheck ? (
          <p className={styles.status}>Still working — the server may be waking up…</p>
        ) : null}
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

  const sampling = reveal.phase === "sampling";

  return (
    <main className={styles.page}>
      <header className={sampling ? `${styles.header} ${styles.headerDimmed}` : styles.header}>
        <div>
          <p className={styles.codeLabel}>Session {normalizedSessionId}</p>
          <h1>Who Should Host?</h1>
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
        <div className={sampling ? `${styles.wheelSlot} ${styles.wheelCentered}` : styles.wheelSlot}>
          <Wheel users={users} pingMatrix={pingMatrix} reveal={reveal} />
        </div>
        <div className={sampling ? `${styles.participantsSlot} ${styles.participantsHidden}` : styles.participantsSlot}>
          <ParticipantList users={users} pingMatrix={pingMatrix} reveal={reveal} selfUserId={selfUserId} />
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
    </main>
  );
}
