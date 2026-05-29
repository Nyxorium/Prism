import { useState, useEffect } from "react";
import { LABELS } from "./labels";
import { oauthClient } from "./oauth";
import type { OAuthSession } from "@atproto/oauth-client-browser";
import "./App.css";

const DEFAULT_PDS = "https://bsky.social";

type Step = "login" | "labels" | "success";
type AuthMethod = "oauth" | "apppassword";

interface Session {
  method: AuthMethod;
  handle: string;
  did: string;
  pdsUrl: string;
  appPassword?: string;
  oauthSession?: OAuthSession;
  currentLabels: string[];
}

export default function App() {
  const [step, setStep] = useState<Step>("login");
  const [handle, setHandle] = useState(() => localStorage.getItem('pridelabeller:handle') ?? '');
  const [appPassword, setAppPassword] = useState("");
  const [pdsUrl, setPdsUrl] = useState(() => localStorage.getItem('pridelabeller:pdsUrl') ?? DEFAULT_PDS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        const result = await oauthClient.init();
        if (result?.session) {
          await loadOAuthSession(result.session);
        }
      } catch (e) {
        console.error("OAuth init failed:", e);
      }
    };
    init();
  }, []);

  const loadOAuthSession = async (oauthSession: OAuthSession) => {
    setLoading(true);
    setError(null);
    try {
      // sub is already verified by the OAuth flow — no need to re-verify
      const did = oauthSession.sub;
      const pds = oauthSession.serverMetadata?.issuer ?? DEFAULT_PDS;

      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifiedDid: did, pdsUrl: pds }),
      });
      const data = await res.json() as Record<string, any>;
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");

      const savedHandle = localStorage.getItem('pridelabeller:handle') ?? did;
      setSession({
        method: "oauth",
        handle: savedHandle,
        did,
        pdsUrl: pds,
        oauthSession,
        currentLabels: data.labels,
      });
      setSelected(new Set(data.labels));
      setStep("labels");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    if (!handle) {
      setError("Please enter your handle first.");
      return;
    }
    setError(null);
    setOauthLoading(true);
    try {
      localStorage.setItem('pridelabeller:handle', handle);
      await oauthClient.signIn(handle);
    } catch (e: any) {
      setError(e.message ?? "OAuth sign in failed. Please try again.");
      setOauthLoading(false);
    }
  };

  const handleAppPasswordLogin = async () => {
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
      localStorage.setItem('pridelabeller:pdsUrl', pdsUrl || DEFAULT_PDS);
      localStorage.setItem('pridelabeller:handle', handle);
      setSession({
        method: "apppassword",
        handle,
        did: data.did,
        pdsUrl: pdsUrl || DEFAULT_PDS,
        appPassword,
        currentLabels: data.labels,
      });
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
    const actions = [
      ...toAdd.map(label => ({ label, action: "add" as const })),
      ...toRemove.map(label => ({ label, action: "remove" as const })),
    ];

    try {
      for (const { label, action } of actions) {
        let body: Record<string, any> = { label, action };
        if (session.method === "oauth") {
          body = { ...body, verifiedDid: session.did, pdsUrl: session.pdsUrl };
        } else {
          body = { ...body, handle: session.handle, appPassword: session.appPassword, pdsUrl: session.pdsUrl };
        }
        const res = await fetch("/api/label", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json() as Record<string, any>;
        if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      setSession(s => s ? { ...s, currentLabels: [...selected] } : s);
      setStep("success");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (session?.method === "oauth" && session.oauthSession) {
      try { await session.oauthSession.signOut(); } catch {}
    }
    setSession(null);
    setStep("login");
    setError(null);
    setSearch("");
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
        {step === "login" && (
          <div className="card">
            <h1 className="card-title">Sign into the Atmosphere</h1>

            <div className="form">
              <label className="label">Handle</label>
              <input
                className="input"
                type="text"
                placeholder="you.bsky.social"
                value={handle}
                onChange={e => setHandle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !showAppPassword && handleOAuthLogin()}
              />
              <button
                className="btn"
                onClick={handleOAuthLogin}
                disabled={oauthLoading || loading || !handle}
              >
                {oauthLoading ? "Redirecting…" : "Continue"}
              </button>
            </div>

            {!showAppPassword && (
              <button className="btn-advanced" onClick={() => setShowAppPassword(true)} type="button">
                ▸ Use app password instead
              </button>
            )}

            {showAppPassword && (
              <div className="form">
                <p className="advanced-hint">
                  Use an <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noreferrer">app password</a> — never your main password.
                </p>
                <label className="label">App password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  value={appPassword}
                  onChange={e => setAppPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAppPasswordLogin()}
                />
                <button
                  className="btn btn--secondary"
                  onClick={handleAppPasswordLogin}
                  disabled={loading || !handle || !appPassword}
                >
                  {loading ? "Signing in…" : "Sign in with app password"}
                </button>

                <button className="btn-advanced" onClick={() => setShowAdvanced(v => !v)} type="button">
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
              </div>
            )}

            {error && <p className="error">{error}</p>}
            <p className="disclaimer">
              Your credentials are used only to verify your identity and are never stored.
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