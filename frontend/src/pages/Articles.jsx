import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getArticles, getPublicArticles, deleteArticle } from "../api/client";

export default function Articles({ ctx }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("my"); // "my" or "public"
  const [myArticles, setMyArticles] = useState([]);
  const [publicArticles, setPublicArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const user = ctx?.user;

  useEffect(() => {
    loadData();
  }, [activeTab, user]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      if (activeTab === "my") {
        if (user) {
          const res = await getArticles();
          setMyArticles(res.data || []);
        } else {
          setMyArticles([]);
        }
      } else {
        const res = await getPublicArticles();
        setPublicArticles(res.data || []);
      }
    } catch {
      setError("Failed to load articles. Please refresh or check connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this research article?")) return;
    try {
      await deleteArticle(id);
      setMyArticles((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert("Failed to delete article.");
    }
  };

  const VISIBILITY_COLORS = {
    private: { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1", label: "🔒 Private" },
    shared: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", label: "👥 Shared" },
    public: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", label: "🌐 Public" },
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1050px", margin: "0 auto", minHeight: "85vh" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none", border: "none", color: "var(--muted)", cursor: "pointer",
              fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.5rem", padding: 0
            }}
          >
            &larr; Back to Dashboard
          </button>
          <h1 style={{ fontSize: "2.3rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
            Research Articles
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "1rem", marginTop: "0.4rem" }}>
            Publish and explore analytical articles grounded in verifiable media shift investigations.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          {user ? (
            <button
              onClick={() => navigate("/article/new")}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)",
              }}
            >
              ✍️ Write Research Article
            </button>
          ) : (
            <button
              onClick={() => ctx?.setShowLogin && ctx.setShowLogin(true)}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.95rem",
                cursor: "pointer",
              }}
            >
              Sign In to Write
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "2rem", gap: "2rem" }}>
        <button
          onClick={() => setActiveTab("my")}
          style={{
            background: "none", border: "none",
            padding: "0.75rem 0.25rem",
            fontSize: "1rem", fontWeight: 700,
            color: activeTab === "my" ? "var(--accent)" : "var(--muted)",
            borderBottom: activeTab === "my" ? "3px solid var(--accent)" : "3px solid transparent",
            cursor: "pointer",
          }}
        >
          My Articles ({myArticles.length})
        </button>
        <button
          onClick={() => setActiveTab("public")}
          style={{
            background: "none", border: "none",
            padding: "0.75rem 0.25rem",
            fontSize: "1rem", fontWeight: 700,
            color: activeTab === "public" ? "var(--accent)" : "var(--muted)",
            borderBottom: activeTab === "public" ? "3px solid var(--accent)" : "3px solid transparent",
            cursor: "pointer",
          }}
        >
          🌐 Public Research Articles ({publicArticles.length})
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", padding: "1rem", color: "#B91C1C", marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : activeTab === "my" && !user ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#F8FAFC", borderRadius: "12px", border: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: "1.3rem", color: "#1E293B", marginBottom: "0.5rem" }}>Sign in to manage your research articles</h3>
          <p style={{ color: "var(--muted)", maxWidth: "420px", margin: "0 auto 1.5rem auto", fontSize: "0.95rem" }}>
            Draft, share, and publish private or public articles tied to your narrative investigations.
          </p>
          <button
            onClick={() => ctx?.setShowLogin && ctx.setShowLogin(true)}
            style={{ padding: "0.75rem 2rem", backgroundColor: "var(--accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
          >
            Sign In
          </button>
        </div>
      ) : (
        <div>
          {activeTab === "my" && myArticles.length === 0 && (
            <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#F8FAFC", borderRadius: "12px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📝</div>
              <h3 style={{ fontSize: "1.3rem", color: "#1E293B", marginBottom: "0.5rem" }}>No research articles yet</h3>
              <p style={{ color: "var(--muted)", maxWidth: "420px", margin: "0 auto 1.5rem auto", fontSize: "0.95rem" }}>
                You can write an article from scratch or generate one directly from any completed investigation.
              </p>
              <button
                onClick={() => navigate("/article/new")}
                style={{ padding: "0.75rem 1.75rem", backgroundColor: "var(--accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
              >
                Write Your First Article
              </button>
            </div>
          )}

          {activeTab === "public" && publicArticles.length === 0 && (
            <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#F8FAFC", borderRadius: "12px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📰</div>
              <h3 style={{ fontSize: "1.3rem", color: "#1E293B", marginBottom: "0.5rem" }}>No public articles published yet</h3>
              <p style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
                Published articles from authors across NarrativeShift will appear here.
              </p>
            </div>
          )}

          {/* Articles list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {(activeTab === "my" ? myArticles : publicArticles).map((a) => {
              const vis = VISIBILITY_COLORS[a.visibility] || VISIBILITY_COLORS.private;
              return (
                <div
                  key={a.id}
                  onClick={() => navigate(`/article/${a.id}`)}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "1.5rem",
                    background: "white",
                    cursor: "pointer",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <h3 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#1E293B", margin: 0, lineHeight: "1.4" }}>
                      {a.title}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                      <span
                        style={{
                          backgroundColor: vis.bg,
                          color: vis.text,
                          border: `1px solid ${vis.border}`,
                          padding: "0.25rem 0.65rem",
                          borderRadius: "999px",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {vis.label}
                      </span>
                    </div>
                  </div>

                  {a.description && (
                    <p style={{ color: "#475569", fontSize: "0.95rem", lineHeight: "1.55", margin: 0 }}>
                      {a.description}
                    </p>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", color: "var(--muted)", flexWrap: "wrap", gap: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid #F1F5F9" }}>
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                      <span>👤 <strong>{a.author_name}</strong></span>
                      {a.updated_at && <span>Updated: {a.updated_at.slice(0, 10)}</span>}
                      {a.investigation_id && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/investigation/${a.investigation_id}`);
                          }}
                          style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}
                        >
                          🔗 Linked Investigation
                        </span>
                      )}
                    </div>

                    {activeTab === "my" && (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/article/edit/${a.id}`);
                          }}
                          style={{
                            background: "#F1F5F9", border: "1px solid var(--border)", borderRadius: "6px",
                            padding: "0.3rem 0.75rem", fontSize: "0.82rem", color: "#334155", cursor: "pointer", fontWeight: 600
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={(e) => handleDelete(a.id, e)}
                          style={{
                            background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "6px",
                            padding: "0.3rem 0.75rem", fontSize: "0.82rem", color: "#B91C1C", cursor: "pointer", fontWeight: 600
                          }}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
