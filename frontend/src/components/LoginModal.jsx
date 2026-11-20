import { useState } from "react";

export default function LoginModal({ ctx }) {
  const { handleGoogleLogin, setShowLogin } = ctx;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      await handleGoogleLogin();
    } catch (e) {
      setError("Login failed. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div
      className="login-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowLogin(false);
      }}
    >
      <div className="login-card fade-in">
        <div style={{ fontSize: "2.75rem", marginBottom: "1rem" }}>📡</div>
        <div
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "var(--text)",
            marginBottom: "0.5rem",
            letterSpacing: "-0.02em",
          }}
        >
          Sign in to NarrativeShift
        </div>
        <div
          style={{
            fontSize: "0.9rem",
            color: "var(--muted)",
            marginBottom: "2rem",
            lineHeight: 1.6,
          }}
        >
          Track narrative shifts, save your research,
          <br />
          and access unlimited analysis.
        </div>

        {error && (
          <div
            className="status-banner status-error"
            style={{ marginBottom: "1rem", justifyContent: "center" }}
          >
            {error}
          </div>
        )}

        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={onGoogle}
          disabled={loading}
          style={{ gap: "0.75rem", marginBottom: "1rem" }}
        >
          {loading ? (
            <span className="spinner" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
          )}
          {loading ? "Signing in..." : "Continue with Google"}
        </button>

        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          Free forever · No credit card · No spam
        </div>

        <button
          onClick={() => setShowLogin(false)}
          style={{
            marginTop: "1.25rem",
            background: "none",
            border: "none",
            color: "var(--muted)",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
