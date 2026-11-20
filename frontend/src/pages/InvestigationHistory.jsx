import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getInvestigations, deleteInvestigation, updateInvestigation } from "../api/client";

export default function InvestigationHistory({ ctx }) {
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editTopic, setEditTopic] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const user = ctx?.user;

  useEffect(() => {
    fetchInvestigations();
  }, [user]);

  const fetchInvestigations = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getInvestigations();
      // Handle either raw array or { investigations: [...] }
      const list = Array.isArray(res.data) ? res.data : (res.data?.investigations || []);
      setInvestigations(list);
    } catch {
      setError("Failed to load investigation history. Please ensure you are signed in.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to permanently delete this investigation?")) return;
    try {
      await deleteInvestigation(id);
      setInvestigations((prev) => prev.filter((i) => i.id !== id));
    } catch {
      alert("Failed to delete investigation. Only the owner can delete it.");
    }
  };

  const handleStartRename = (inv, e) => {
    e.stopPropagation();
    setEditingId(inv.id);
    setEditTopic(inv.topic);
  };

  const handleSaveRename = async (invId, e) => {
    e.stopPropagation();
    if (!editTopic.trim()) return;
    try {
      await updateInvestigation(invId, { topic: editTopic.trim() });
      setInvestigations((prev) =>
        prev.map((i) => (i.id === invId ? { ...i, topic: editTopic.trim() } : i))
      );
      setEditingId(null);
    } catch {
      alert("Failed to rename investigation.");
    }
  };

  const filtered = investigations.filter((i) =>
    i.topic?.toLowerCase().includes(filterQuery.toLowerCase())
  );

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
            Saved Investigations & History
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "1rem", marginTop: "0.4rem" }}>
            Review, reopen, rename, and publish research articles from your historical media investigations.
          </p>
        </div>

        <button
          onClick={() => navigate("/")}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)"
          }}
        >
          🔍 New Investigation
        </button>
      </div>

      {/* Filter / Search input */}
      <div style={{ marginBottom: "1.5rem" }}>
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter saved investigations by topic..."
          style={{
            width: "100%", padding: "0.8rem 1rem", borderRadius: "8px", border: "1px solid var(--border)",
            fontSize: "0.95rem", outline: "none", background: "white"
          }}
        />
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
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#F8FAFC", borderRadius: "12px", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📁</div>
          <h3 style={{ fontSize: "1.3rem", color: "#1E293B", marginBottom: "0.5rem" }}>
            {filterQuery ? "No investigations match your search" : "No saved investigations found"}
          </h3>
          <p style={{ color: "var(--muted)", maxWidth: "420px", margin: "0 auto 1.5rem auto", fontSize: "0.95rem" }}>
            Investigations run on any topic are permanently persisted to PostgreSQL and will appear here.
          </p>
          <button
            onClick={() => navigate("/")}
            style={{ padding: "0.75rem 1.75rem", backgroundColor: "var(--accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
          >
            Start an Investigation
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filtered.map((inv) => (
            <div
              key={inv.id}
              onClick={() => navigate(`/investigation/${inv.id}`)}
              style={{
                padding: "1.5rem",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                cursor: "pointer",
                display: "grid",
                gridTemplateColumns: "2.5fr 1fr 1fr auto",
                alignItems: "center",
                gap: "1.5rem",
                backgroundColor: "white",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
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
              {/* Topic & Year */}
              <div>
                {editingId === inv.id ? (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTopic}
                      onChange={(e) => setEditTopic(e.target.value)}
                      style={{ padding: "0.4rem 0.6rem", fontSize: "1.1rem", borderRadius: "6px", border: "1px solid var(--accent)" }}
                    />
                    <button
                      onClick={(e) => handleSaveRename(inv.id, e)}
                      style={{ padding: "0.4rem 0.8rem", background: "var(--accent)", color: "white", border: "none", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      style={{ padding: "0.4rem 0.8rem", background: "#F1F5F9", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "0.82rem", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.25rem", color: "#1E293B", lineHeight: "1.3" }}>
                      {inv.topic}
                    </div>
                    <button
                      onClick={(e) => handleStartRename(inv, e)}
                      title="Rename investigation"
                      style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.85rem", padding: "0.2rem" }}
                    >
                      ✏️
                    </button>
                  </div>
                )}
                <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.3rem" }}>
                  🗓 {inv.start_year} &ndash; {inv.end_year}
                  {inv.created_at && <span> &bull; Started {inv.created_at.slice(0, 10)}</span>}
                </div>
              </div>

              {/* Coverage & Peak Shift */}
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                  Peak Shift
                </div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: inv.peak_shift > 15 ? "#EF4444" : "#22C55E" }}>
                  {inv.peak_shift != null ? `${inv.peak_shift}%` : "—"}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#64748B" }}>
                  {inv.total_articles ? `${inv.total_articles} articles` : "Analysed"}
                </div>
              </div>

              {/* Status */}
              <div>
                <span
                  style={{
                    backgroundColor: inv.status === "completed" ? "#ECFDF5" : "#FEF3C7",
                    color: inv.status === "completed" ? "#047857" : "#92400E",
                    border: `1px solid ${inv.status === "completed" ? "#A7F3D0" : "#FDE68A"}`,
                    padding: "0.25rem 0.65rem",
                    borderRadius: "999px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {inv.status}
                </span>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/article/new?investigationId=${inv.id}`);
                  }}
                  title="Write article from this investigation"
                  style={{
                    background: "#EEF2FF", border: "1px solid #C7D2FE", color: "#4F46E5",
                    padding: "0.45rem 0.8rem", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer"
                  }}
                >
                  ✍️ Write Article
                </button>
                <button
                  onClick={(e) => handleDelete(inv.id, e)}
                  title="Delete investigation"
                  style={{
                    background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#B91C1C",
                    padding: "0.45rem 0.65rem", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer"
                  }}
                >
                  🗑
                </button>
                <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: "1.1rem", paddingLeft: "0.25rem" }}>
                  &rarr;
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
