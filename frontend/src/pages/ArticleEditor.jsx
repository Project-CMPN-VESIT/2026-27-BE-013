import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getArticle, createArticle, updateArticle, deleteArticle, getInvestigationDetails } from "../api/client";

export default function ArticleEditor({ ctx }) {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const [searchParams] = useSearchParams();
  const investigationIdParam = searchParams.get("investigationId");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [sharedWithInput, setSharedWithInput] = useState("");
  const [investigationId, setInvestigationId] = useState(investigationIdParam || "");
  const [investigationTopic, setInvestigationTopic] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (editId) {
      loadArticle(editId);
    } else if (investigationIdParam) {
      loadInvestigationContext(investigationIdParam);
    }
  }, [editId, investigationIdParam]);

  const loadArticle = async (articleId) => {
    setLoading(true);
    try {
      const res = await getArticle(articleId);
      const a = res.data;
      setTitle(a.title || "");
      setDescription(a.description || "");
      setBody(a.body || "");
      setVisibility(a.visibility || "private");
      setSharedWithInput((a.shared_with || []).join(", "));
      setInvestigationId(a.investigation_id || "");
      if (a.investigation_id) {
        loadInvestigationContext(a.investigation_id);
      }
    } catch {
      setError("Failed to load article. You may not have edit permissions.");
    } finally {
      setLoading(false);
    }
  };

  const loadInvestigationContext = async (invId) => {
    try {
      const res = await getInvestigationDetails(invId);
      setInvestigationTopic(res.data.topic || "");
      if (!title && !editId) {
        setTitle(`Analysis of Narrative Shift: ${res.data.topic}`);
      }
      if (!body && !editId) {
        const meta = res.data.metadata || {};
        const shifts = meta.shifts?.shifts || {};
        const peak = Object.entries(shifts).sort((a, b) => b[1] - a[1])[0];
        setBody(
          `## Executive Summary\n\n` +
          `This research article investigates the temporal media evolution of **${res.data.topic}** (${res.data.start_year}–${res.data.end_year}).\n\n` +
          (peak ? `The peak narrative shift observed was **${Number(peak[1]).toFixed(1)}%** between **${peak[0]}**.\n\n` : "") +
          `## Key Findings\n\n` +
          `- First key finding from empirical investigation.\n` +
          `- Second key shift in framing and tone.\n\n` +
          `## Methodology & Evidence Citation\n\n` +
          `Analysis grounded in ${meta.total_usable_articles || 100} extracted news reports using sentence-transformers and Twitter-RoBERTa sentiment models.`
        );
      }
    } catch {
      // Non-critical, ignore
    }
  };

  const handleSave = async (targetVisibility = visibility) => {
    if (!title.trim()) {
      setError("Please provide a title for your article.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccessMsg("");

    const sharedList = sharedWithInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      body,
      visibility: targetVisibility,
      shared_with: sharedList,
      investigation_id: investigationId || null,
    };

    try {
      if (editId) {
        await updateArticle(editId, payload);
        setVisibility(targetVisibility);
        setSuccessMsg("Article updated successfully.");
      } else {
        const res = await createArticle(payload);
        setSuccessMsg("Article created successfully.");
        setTimeout(() => navigate(`/article/${res.data.id}`), 600);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save article.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    if (!window.confirm("Are you sure you want to permanently delete this research article?")) return;
    try {
      await deleteArticle(editId);
      navigate("/articles");
    } catch {
      setError("Failed to delete article.");
    }
  };

  const insertSnippet = (snippet) => {
    setBody((prev) => prev + "\n\n" + snippet);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "980px", margin: "0 auto", minHeight: "85vh" }}>
      {/* Top action bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <button
          onClick={() => navigate("/articles")}
          style={{
            background: "none", border: "none", color: "var(--muted)", cursor: "pointer",
            fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem", padding: 0
          }}
        >
          &larr; Back to Articles
        </button>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {editId && (
            <button
              onClick={handleDelete}
              style={{
                background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#B91C1C",
                padding: "0.6rem 1.1rem", borderRadius: "8px", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer"
              }}
            >
              Delete
            </button>
          )}

          <button
            onClick={() => handleSave("private")}
            disabled={saving}
            style={{
              background: "#F1F5F9", border: "1px solid var(--border)", color: "#334155",
              padding: "0.6rem 1.25rem", borderRadius: "8px", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer"
            }}
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>

          <button
            onClick={() => handleSave("public")}
            disabled={saving}
            style={{
              background: "var(--accent)", border: "none", color: "white",
              padding: "0.6rem 1.4rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
              boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)"
            }}
          >
            {saving ? "Saving..." : "🚀 Publish Publicly"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", padding: "1rem", color: "#B91C1C", marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "8px", padding: "1rem", color: "#047857", marginBottom: "1.5rem" }}>
          {successMsg}
        </div>
      )}

      {/* Linked investigation banner */}
      {investigationId && (
        <div style={{
          background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "10px",
          padding: "0.85rem 1.25rem", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <div>
            <span style={{ fontSize: "0.8rem", color: "#7C3AED", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              🔗 Grounded in Investigation
            </span>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#4C1D95", marginTop: "0.2rem" }}>
              {investigationTopic || investigationId}
            </div>
          </div>
          <button
            onClick={() => navigate(`/investigation/${investigationId}`)}
            style={{
              background: "white", border: "1px solid #DDD6FE", color: "#6D28D9",
              padding: "0.4rem 0.8rem", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer"
            }}
          >
            View Investigation
          </button>
        </div>
      )}

      {/* Main editor form */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", background: "white", border: "1px solid var(--border)", borderRadius: "12px", padding: "2rem" }}>
        {/* Title */}
        <div>
          <label style={{ display: "block", fontWeight: 700, fontSize: "0.95rem", color: "#1E293B", marginBottom: "0.5rem" }}>
            Article Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. How Global Media Coverage of Climate Policy Shifted (2021–2024)"
            style={{
              width: "100%", padding: "0.85rem 1rem", fontSize: "1.2rem", fontWeight: 600,
              borderRadius: "8px", border: "1px solid var(--border)", outline: "none"
            }}
          />
        </div>

        {/* Description */}
        <div>
          <label style={{ display: "block", fontWeight: 700, fontSize: "0.95rem", color: "#1E293B", marginBottom: "0.5rem" }}>
            Summary / Subtitle (Optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief one or two sentence overview of this research article"
            style={{
              width: "100%", padding: "0.75rem 1rem", fontSize: "1rem",
              borderRadius: "8px", border: "1px solid var(--border)", outline: "none"
            }}
          />
        </div>

        {/* Visibility & Collaboration */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem", background: "#F8FAFC", padding: "1.25rem", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
          <div>
            <label style={{ display: "block", fontWeight: 700, fontSize: "0.9rem", color: "#1E293B", marginBottom: "0.4rem" }}>
              Visibility Level
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              style={{
                width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.95rem",
                borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "white", outline: "none", fontWeight: 600
              }}
            >
              <option value="private">🔒 Private (Only You)</option>
              <option value="shared">👥 Shared (Selected Users)</option>
              <option value="public">🌐 Public (Anyone Can Read)</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 700, fontSize: "0.9rem", color: "#1E293B", marginBottom: "0.4rem" }}>
              {visibility === "shared" ? "Share With (Comma-separated emails or User IDs) *" : "Sharing Notes"}
            </label>
            <input
              type="text"
              value={sharedWithInput}
              onChange={(e) => setSharedWithInput(e.target.value)}
              disabled={visibility !== "shared"}
              placeholder={visibility === "shared" ? "colleague@example.com, user2@domain.com" : "Select 'Shared' visibility above to specify collaborators."}
              style={{
                width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.95rem",
                borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: visibility === "shared" ? "white" : "#F1F5F9", outline: "none"
              }}
            />
          </div>
        </div>

        {/* Quick Insert Helpers */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)" }}>Quick Insert:</span>
          <button
            type="button"
            onClick={() => insertSnippet("### Narrative Evolution Analysis\nAnalysis of the year-by-year narrative continuity shows...")}
            style={{ background: "#F1F5F9", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.25rem 0.6rem", fontSize: "0.8rem", cursor: "pointer" }}
          >
            + Evolution Section
          </button>
          <button
            type="button"
            onClick={() => insertSnippet("### Empirical Claim Verification\n> Exact evidence quote from source.\n— *Source, YYYY-MM-DD*")}
            style={{ background: "#F1F5F9", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.25rem 0.6rem", fontSize: "0.8rem", cursor: "pointer" }}
          >
            + Evidence Quote
          </button>
          <button
            type="button"
            onClick={() => insertSnippet("### Shift Decomposition\nBased on deterministic feature decomposition, the shift aligns with...")}
            style={{ background: "#F1F5F9", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.25rem 0.6rem", fontSize: "0.8rem", cursor: "pointer" }}
          >
            + Decomposition Section
          </button>
        </div>

        {/* Body Editor */}
        <div>
          <label style={{ display: "block", fontWeight: 700, fontSize: "0.95rem", color: "#1E293B", marginBottom: "0.5rem" }}>
            Article Body (Markdown Supported) *
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your research article here. Use markdown for headings (## Section), lists (- item), bold (**text**), and blockquotes (> quote)."
            rows={18}
            style={{
              width: "100%", padding: "1rem", fontSize: "1rem", lineHeight: "1.65",
              borderRadius: "8px", border: "1px solid var(--border)", outline: "none",
              fontFamily: "Inter, -apple-system, sans-serif", resize: "vertical"
            }}
          />
        </div>
      </div>
    </div>
  );
}
