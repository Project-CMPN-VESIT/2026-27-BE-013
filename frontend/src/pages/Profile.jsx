import { useNavigate } from "react-router-dom";

export default function Profile({ ctx }) {
  const { user, setUser, history, setHistory } = ctx;
  const navigate = useNavigate();

  if (!user) {
    return (
      <div style={{ textAlign: "center", paddingTop: "4rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔐</div>
        <div
          style={{
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: "0.5rem",
          }}
        >
          You are not logged in
        </div>
        <div style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
          Sign in to view your profile and saved searches.
        </div>
        <button
          className="btn btn-primary"
          onClick={() => ctx.setShowLogin(true)}
        >
          Sign In
        </button>
      </div>
    );
  }

  const deleteItem = (id) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const loadItem = (item) => {
    ctx.onSearchDone(
      item.result,
      item.topic_key,
      item.topic_cfg,
      item.start_yr,
      item.end_yr,
    );
  };

  return (
    <div>
      {/* Hero */}
      <div className="hero">
        <div className="hero-badge">Profile</div>
        <div className="hero-title" style={{ fontSize: "1.8rem" }}>
          {user.name}
        </div>
        <div className="hero-sub">{user.email}</div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {[
          { label: "Total Searches", value: history.length },
          { label: "Saved Analyses", value: history.length },
          { label: "Member Since", value: "Today" },
        ].map((s, i) => (
          <div key={i} className="metric-card">
            <div className="metric-value">{s.value}</div>
            <div className="metric-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Saved searches */}
      <div className="section-label">Saved Analyses ({history.length})</div>

      {history.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            color: "var(--muted)",
            padding: "3rem",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📊</div>
          <div>No saved analyses yet.</div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
            Run an analysis and click Save to store it here.
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: "1rem" }}
            onClick={() => navigate("/")}
          >
            Start Analysing →
          </button>
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          {history.map((item, i) => (
            <div
              key={item.id || i}
              className="card-sm"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: "0.2rem",
                  }}
                >
                  {item.topic}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {item.start_yr} – {item.end_yr}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn btn-primary"
                  style={{ padding: "0.4rem 0.875rem", fontSize: "0.8rem" }}
                  onClick={() => loadItem(item)}
                >
                  Load
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: "0.4rem 0.875rem", fontSize: "0.8rem" }}
                  onClick={() => deleteItem(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="divider" />

      {/* Account actions */}
      <div className="section-label">Account</div>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          className="btn btn-ghost"
          onClick={() => {
            ctx.setShowLogin(true);
          }}
        >
          Switch Account
        </button>
        <button
          className="btn btn-danger"
          onClick={() => {
            setUser(null);
            navigate("/");
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
