import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getArticle, getPublicArticle, getInvestigationDetails } from "../api/client";

export default function ArticleReader({ ctx }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [investigation, setInvestigation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const user = ctx?.user;

  useEffect(() => {
    loadArticle();
  }, [id, user]);

  const loadArticle = async () => {
    setLoading(true);
    setError("");
    try {
      let res;
      // Try authenticated endpoint first if user is logged in, else public
      if (user) {
        try {
          res = await getArticle(id);
        } catch {
          res = await getPublicArticle(id);
        }
      } else {
        res = await getPublicArticle(id);
      }
      setArticle(res.data);
      if (res.data.investigation_id) {
        try {
          const invRes = await getInvestigationDetails(res.data.investigation_id);
          setInvestigation(invRes.data);
        } catch {
          // Non-critical if investigation is private or unavailable
        }
      }
    } catch {
      setError("This article is private, has been deleted, or requires specific authorization.");
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} style={{ height: "0.75rem" }} />;
      if (trimmed.startsWith("### ")) {
        return (
          <h3 key={idx} style={{ fontSize: "1.3rem", fontWeight: 700, margin: "1.5rem 0 0.5rem 0", color: "#1E293B" }}>
            {trimmed.replace(/^###\s+/, "")}
          </h3>
        );
      }
      if (trimmed.startsWith("## ")) {
        return (
          <h2 key={idx} style={{ fontSize: "1.6rem", fontWeight: 800, margin: "2rem 0 0.75rem 0", color: "#0F172A", borderBottom: "1px solid #E2E8F0", paddingBottom: "0.4rem" }}>
            {trimmed.replace(/^##\s+/, "")}
          </h2>
        );
      }
      if (trimmed.startsWith("# ")) {
        return (
          <h1 key={idx} style={{ fontSize: "2rem", fontWeight: 800, margin: "2rem 0 1rem 0", color: "#0F172A" }}>
            {trimmed.replace(/^#\s+/, "")}
          </h1>
        );
      }
      if (trimmed.startsWith("> ")) {
        return (
          <blockquote key={idx} style={{
            borderLeft: "4px solid var(--accent)", background: "#F8FAFC", padding: "0.75rem 1.25rem",
            margin: "1rem 0", fontStyle: "italic", color: "#334155", borderRadius: "0 8px 8px 0"
          }}>
            {trimmed.replace(/^>\s+/, "")}
          </blockquote>
        );
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        return (
          <li key={idx} style={{ marginLeft: "1.5rem", marginBottom: "0.5rem", lineHeight: "1.7", color: "#334155", fontSize: "1.05rem" }}>
            {trimmed.replace(/^[-*]\s+/, "")}
          </li>
        );
      }
      return (
        <p key={idx} style={{ marginBottom: "1rem", lineHeight: "1.75", color: "#334155", fontSize: "1.05rem" }}>
          {trimmed}
        </p>
      );
    });
  };

  const VISIBILITY_LABELS = {
    private: { bg: "#F1F5F9", text: "#475569", label: "🔒 Private" },
    shared: { bg: "#EFF6FF", text: "#1D4ED8", label: "👥 Shared" },
    public: { bg: "#ECFDF5", text: "#047857", label: "🌐 Public" },
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "6rem" }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div style={{ padding: "4rem 2rem", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
        <h2 style={{ fontSize: "1.8rem", color: "#0F172A", marginBottom: "0.75rem" }}>Access Restricted</h2>
        <p style={{ color: "var(--muted)", lineHeight: "1.6", marginBottom: "2rem" }}>
          {error || "Article could not be found."}
        </p>
        <button
          onClick={() => navigate("/articles")}
          style={{ padding: "0.75rem 1.5rem", backgroundColor: "var(--accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
        >
          &larr; Back to Research Articles
        </button>
      </div>
    );
  }

  const vis = VISIBILITY_LABELS[article.visibility] || VISIBILITY_LABELS.public;

  return (
    <div style={{ padding: "2rem 1.5rem", maxWidth: "860px", margin: "0 auto", minHeight: "85vh" }}>
      {/* Top navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <button
          onClick={() => navigate("/articles")}
          style={{
            background: "none", border: "none", color: "var(--muted)", cursor: "pointer",
            fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem", padding: 0
          }}
        >
          &larr; Back to Research Articles
        </button>

        {article.is_owner && (
          <button
            onClick={() => navigate(`/article/edit/${article.id}`)}
            style={{
              background: "#F1F5F9", border: "1px solid var(--border)", color: "#334155",
              padding: "0.45rem 0.95rem", borderRadius: "6px", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer"
            }}
          >
            ✏️ Edit Article
          </button>
        )}
      </div>

      {/* Article Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem" }}>
          <span
            style={{
              backgroundColor: vis.bg,
              color: vis.text,
              padding: "0.2rem 0.65rem",
              borderRadius: "999px",
              fontSize: "0.78rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.03em"
            }}
          >
            {vis.label}
          </span>
          {article.updated_at && (
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              {article.updated_at.slice(0, 10)}
            </span>
          )}
        </div>

        <h1 style={{ fontSize: "2.6rem", fontWeight: 800, color: "#0F172A", lineHeight: "1.25", letterSpacing: "-0.02em", margin: "0 0 1rem 0" }}>
          {article.title}
        </h1>

        {article.description && (
          <p style={{ fontSize: "1.2rem", color: "#475569", lineHeight: "1.55", margin: "0 0 1.25rem 0" }}>
            {article.description}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingTop: "1rem", borderTop: "1px solid #E2E8F0" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
            {article.author_name ? article.author_name[0].toUpperCase() : "A"}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#1E293B", fontSize: "0.95rem" }}>
              {article.author_name}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              Research Author
            </div>
          </div>
        </div>
      </div>

      {/* Investigation attribution banner */}
      {article.investigation_id && (
        <div style={{
          background: "linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)",
          border: "1px solid #C7D2FE",
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
          marginBottom: "2.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}>
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              VERIFIED EMPIRICAL RESEARCH
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#312E81", marginTop: "0.2rem" }}>
              Grounded in Investigation: {investigation?.topic || "Media Shift Analysis"}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#4338CA", marginTop: "0.2rem" }}>
              Based on news acquisition, semantic shift decomposition, and CardiffNLP sentiment analysis.
            </div>
          </div>

          <button
            onClick={() => navigate(`/investigation/${article.investigation_id}`)}
            style={{
              padding: "0.6rem 1.25rem",
              backgroundColor: "#4F46E5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(79, 70, 229, 0.25)"
            }}
          >
            Explore Investigation Data &rarr;
          </button>
        </div>
      )}

      {/* Article Body */}
      <div style={{
        background: "white",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "3rem",
        boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
        lineHeight: "1.75"
      }}>
        {renderMarkdown(article.body)}
      </div>
    </div>
  );
}
