import { useState, useEffect } from "react";
import { LABELS } from "./labels";
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

export default function App() {
  const [step, setStep] = useState<Step>("restoring");
  const [handle, setHandle] = useState(() => localStorage.getItem("pridelabeller:handle") ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [pdsUrl, setPdsUrl] = useState(() => localStorage.getItem("pridelabeller:pdsUrl") ?? DEFAULT_PDS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, appPassword, pdsUrl: pdsUrl || DEFAULT_PDS }),
      });
      const data = await res.json() as Record<string, any>;
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");

      const stored: StoredSession = {
        handle,
        pdsUrl: pdsUrl || DEFAULT_PDS,
        did: data.did,
        accessJwt: data.accessJwt,
        refreshJwt: data.refreshJwt,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
      localStorage.setItem("pridelabeller:pdsUrl", pdsUrl || DEFAULT_PDS);
      localStorage.setItem("pridelabeller:handle", handle);

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
                  <label className="label">PDS URL</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="https://bsky.social"
                    value={pdsUrl}
                    onChange={e => setPdsUrl(e.target.value)}
                  />
                  <p className="advanced-hint">
                    Only change this if your account is hosted on a custom PDS.
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