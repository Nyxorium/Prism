import { useState, useEffect, useRef } from "react";
import { LABELS } from "./labels";
import { resolveToPds, ResolveError } from "./lib/atproto-resolve";
import "./App.css";

const DEFAULT_PDS = "https://bsky.social";
const SESSION_KEY = "pridelabeller:session";

type Step = "login" | "restoring" | "labels" | "success";

interface Session {
  handle: string;
  pdsUrl: string;
  did: string;
  accessJwt: string;
  refreshJwt: string;
  currentLabels: string[];
}

interface StoredSession {
  handle: string;
  pdsUrl: string;
  did: string;
  accessJwt: string;
  refreshJwt: string;
}

async function refreshStoredSession(stored: StoredSession): Promise<StoredSession | null> {
  try {
    const res = await fetch(`${stored.pdsUrl}/xrpc/com.atproto.server.refreshSession`, {
      method: "POST",
      headers: { Authorization: `Bearer ${stored.refreshJwt}` },
    });
    if (!res.ok) throw new Error("refresh failed");
    const data = await res.json() as Record<string, any>;
    const refreshed: StoredSession = {
      ...stored,
      accessJwt: data.accessJwt,
      refreshJwt: data.refreshJwt,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
    return refreshed;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

// pridelabeller:pdsUrl is only valid if pridelabeller:handle still matches.
function getCachedPds(handle: string): string {
  if (!handle) return "";
  if (localStorage.getItem("pridelabeller:handle") !== handle) return "";
  return localStorage.getItem("pridelabeller:pdsUrl") ?? "";
}

export default function App() {
  const [step, setStep] = useState<Step>("restoring");
  const [handle, setHandle] = useState(() => localStorage.getItem("pridelabeller:handle") ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [pdsUrl, setPdsUrl] = useState(() => getCachedPds(handle));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // True if pdsUrl came from auto-detection
  // Only auto-detected values get overwritten by later runs.
  const pdsAutoFilled = useRef(true);
  // Handle we've already resolved a PDS for; lets detectPds skip repeats.
  const lastResolvedHandle = useRef(getCachedPds(handle) ? handle : "");
  // Bumped per attempt so a stale result can never overwrite a newer one.
  const resolveRequestId = useRef(0);
  const [pdsDetecting, setPdsDetecting] = useState(false);
  const [pdsDetectError, setPdsDetectError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      setStep("login");
      return;
    }

    const parsed: StoredSession = JSON.parse(stored);

    refreshStoredSession(parsed).then(refreshed => {
      if (!refreshed) {
        setStep("login");
        return;
      }

      // Fetch current labels using the refreshed session
      fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessJwt: refreshed.accessJwt, did: refreshed.did, pdsUrl: refreshed.pdsUrl }),
      })
        .then(r => r.json() as Promise<Record<string, any>>)
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setSession({ ...refreshed, currentLabels: data.labels });
          setSelected(new Set(data.labels));
          setStep("labels");
        })
        .catch(() => {
          localStorage.removeItem(SESSION_KEY);
          setStep("login");
        });
    });
  }, []);

  // Resolves the PDS for a handle, Skips if already resolved/cached.
  const detectPds = async (targetHandle: string) => {
    if (!targetHandle || !pdsAutoFilled.current) return;
    if (targetHandle === lastResolvedHandle.current) return;

    // Claim an id so a slower, earlier attempt can't mess with a newer one.
    const requestId = ++resolveRequestId.current;

    setPdsDetecting(true);
    setPdsDetectError(null);
    try {
      const resolved = await resolveToPds(targetHandle);
      if (resolveRequestId.current !== requestId || !pdsAutoFilled.current) return;
      setPdsUrl(resolved);
      lastResolvedHandle.current = targetHandle;
    } catch (err) {
      if (resolveRequestId.current !== requestId || !pdsAutoFilled.current) return;
      setPdsUrl("");
      setPdsDetectError(err instanceof ResolveError ? err.message : "Couldn't auto-detect your provider.");
    } finally {
      if (resolveRequestId.current === requestId) setPdsDetecting(false);
    }
  };

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      let effectivePds = pdsUrl;
      // If detection hasn't run yet (e.g. Continue before blur fired), resolve
      // synchronously rather than falling back to an incorrect PDS.
      if (!effectivePds && pdsAutoFilled.current) {
        resolveRequestId.current++; // invalidate any pending detectPds attempt
        try {
          effectivePds = await resolveToPds(handle);
          setPdsUrl(effectivePds);
          lastResolvedHandle.current = handle;
        } catch (err) {
          throw new Error(
            err instanceof ResolveError
              ? err.message
              : "Couldn't auto-detect your provider. Try setting it manually under Advanced."
          );
        }
      }

      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, appPassword, pdsUrl: effectivePds || DEFAULT_PDS }),
      });
      const data = await res.json() as Record<string, any>;
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");

      const stored: StoredSession = {
        handle,
        pdsUrl: effectivePds || DEFAULT_PDS,
        did: data.did,
        accessJwt: data.accessJwt,
        refreshJwt: data.refreshJwt,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
      localStorage.setItem("pridelabeller:handle", handle);
      localStorage.setItem("pridelabeller:pdsUrl", effectivePds || DEFAULT_PDS);

      setSession({ ...stored, currentLabels: data.labels });
      setSelected(new Set(data.labels));
      setStep("labels");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!session) return;
    setError(null);
    setLoading(true);

    const toAdd = [...selected].filter(l => !session.currentLabels.includes(l));
    const toRemove = session.currentLabels.filter(l => !selected.has(l));
    const labels = [
      ...toAdd.map(label => ({ label, action: "add" as const })),
      ...toRemove.map(label => ({ label, action: "remove" as const })),
    ];

    try {
      const res = await fetch("/api/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessJwt: session.accessJwt,
          did: session.did,
          pdsUrl: session.pdsUrl,
          labels,
        }),
      });
      const data = await res.json() as Record<string, any>;
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setSession(s => s ? { ...s, currentLabels: [...selected] } : s);
      setStep("success");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setStep("login");
    setError(null);
    setSearch("");
    setAppPassword("");
  };

  const toggleLabel = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const hasChanges = session
    ? [...selected].some(l => !session.currentLabels.includes(l)) ||
      session.currentLabels.some(l => !selected.has(l))
    : false;

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <span className="logo">🏳️‍🌈 PrideLabeller</span>
          <span className="tagline">Add pride labels to your profile using <a href="https://bsky.app/profile/pridelabeller.bsky.social" target="_blank" rel="noreferrer">pridelabeller.bsky.social</a></span>
        </div>
      </header>

      <main className="main">
        {step === "restoring" && (
          <div className="card">
            <p className="card-subtitle">Signing you back in…</p>
          </div>
        )}

        {step === "login" && (
          <div className="card">
            <h1 className="card-title">Sign into the Atmosphere</h1>
            <p className="card-subtitle">
              Use an{" "}
              <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noreferrer">
                app password
              </a>{" "}
              — never your main password.
            </p>
            <div className="form">
              <label className="label">Handle or email</label>
              <input
                className="input"
                type="text"
                placeholder="you.bsky.social"
                value={handle}
                onChange={e => setHandle(e.target.value)}
                onBlur={e => detectPds(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
              <label className="label">App password</label>
              <input
                className="input"
                type="password"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                value={appPassword}
                onChange={e => setAppPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />

              <button
                className="btn-advanced"
                onClick={() => setShowAdvanced(v => !v)}
                type="button"
              >
                {showAdvanced ? "▾" : "▸"} Advanced
              </button>

              {showAdvanced && (
                <>
                  <label className="label">Hosting Provider</label>
                  <div className="pds-row">
                    <input
                      className="input"
                      type="text"
                      placeholder={pdsDetecting ? "Detecting…" : "Auto-detected from your handle"}
                      value={pdsUrl}
                      onChange={e => {
                        pdsAutoFilled.current = false;
                        setPdsDetectError(null);
                        setPdsUrl(e.target.value);
                      }}
                    />
                    <button
                      type="button"
                      className="btn-retry"
                      title="Re-detect from handle"
                      disabled={pdsDetecting || !handle}
                      onClick={() => {
                        pdsAutoFilled.current = true;
                        lastResolvedHandle.current = "";
                        detectPds(handle);
                      }}
                    >
                      ↻
                    </button>
                  </div>
                  <p className="advanced-hint">
                    {pdsDetectError
                      ? `${pdsDetectError} Enter your provider's URL manually above.`
                      : "We'll fill this in automatically! Override if something goes wrong."}
                  </p>
                </>
              )}

              {error && <p className="error">{error}</p>}
              <button
                className="btn"
                onClick={handleLogin}
                disabled={loading || !handle || !appPassword}
              >
                {loading ? "Signing in…" : "Continue"}
              </button>
            </div>
            <p className="disclaimer">
              Your credentials are used only to verify your identity and are never stored outside of your device.
            </p>
          </div>
        )}

        {step === "labels" && session && (
          <div className="card">
            <h1 className="card-title">Choose your labels</h1>
            <div className="subtitle-row">
              <span className="text-muted">Signed in as <strong>{session.handle}</strong></span>
              <button className="btn-signout" onClick={handleSignOut}>Sign out</button>
            </div>
            <input
              className="input"
              type="text"
              placeholder="Search labels…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {(() => {
              const q = search.toLowerCase();
              const filtered = LABELS.filter(l => l.name.toLowerCase().includes(q));
              return filtered.length > 0
                ? (
                  <div className="label-grid">
                    {filtered.map(({ id, name }) => (
                      <button
                        key={id}
                        className={`label-chip ${selected.has(id) ? "label-chip--active" : ""}`}
                        onClick={() => toggleLabel(id)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )
                : <p className="no-changes">No labels found.</p>;
            })()}
            {error && <p className="error">{error}</p>}
            <button className="btn" onClick={handleSubmit} disabled={loading || !hasChanges}>
              {loading ? "Saving…" : hasChanges ? "Save labels" : "No changes to save"}
            </button>
          </div>
        )}

        {step === "success" && (
          <div className="card">
            <h1 className="card-title">Done! 🎉</h1>
            <p className="card-subtitle">
              Your labels have been updated. They may take a moment to appear on your profile.
            </p>
            <button
              className="btn"
              onClick={() => {
                setStep("labels");
                setError(null);
              }}
            >
              Make more changes
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          PrideLabeller ·{" "}
          <a href="https://github.com/Nyxorium" target="_blank" rel="noreferrer">
            Nyxorium
          </a>
        </p>
      </footer>
    </div>
  );
}