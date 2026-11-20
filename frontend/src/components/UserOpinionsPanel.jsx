import { useState, useEffect } from "react";
import { getInvestigationOpinions, createInvestigationOpinion, updateOpinion, deleteOpinion } from "../api/client";

export default function UserOpinionsPanel({ investigationId, currentUser, onAuthRequired }) {
  const [opinions, setOpinions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [targetType, setTargetType] = useState("investigation");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadOpinions();
  }, [investigationId]);

  const loadOpinions = async () => {
    if (!investigationId) return;
    setLoading(true);
    try {
      const res = await getInvestigationOpinions(investigationId);
      setOpinions(res.data || []);
    } catch {
      // If unauthenticated or no access, gracefully empty
      setOpinions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      if (onAuthRequired) onAuthRequired();
      return;
    }
    if (!newNote.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await createInvestigationOpinion(investigationId, {
        target_type: targetType,
        target_id: "general",
        note_text: newNote.trim(),
      });
      setOpinions((prev) => [...prev, res.data]);
      setNewNote("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit opinion.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (op) => {
    setEditingId(op.id);
    setEditText(op.note_text);
  };

  const handleSaveEdit = async (opId) => {
    if (!editText.trim()) return;
    try {
      await updateOpinion(opId, { note_text: editText.trim() });
      setOpinions((prev) =>
        prev.map((o) => (o.id === opId ? { ...o, note_text: editText.trim() } : o))
      );
      setEditingId(null);
      setEditText("");
    } catch {
      alert("Failed to update opinion.");
    }
  };

  const handleDelete = async (opId) => {
    if (!window.confirm("Delete this research opinion?")) return;
    try {
      await deleteOpinion(opId);
      setOpinions((prev) => prev.filter((o) => o.id !== opId));
    } catch {
      alert("Failed to delete opinion.");
    }
  };

  const TARGET_LABELS = {
    investigation: "General Investigation",
    narrative: "Narrative Finding",
    claim: "Claim Analysis",
    evidence: "Evidence Verification",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Epistemic disclaimer banner */}
      <div style={{
        background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px",
        padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#92400E", display: "flex", gap: "0.5rem"
      }}>
        <span>💡</span>
        <div>
          <strong>Epistemic Distinction:</strong> Comments in this section are <strong>USER OPINION</strong> submitted by verified researchers, and are strictly distinguished from deterministic <strong>SYSTEM OBSERVATION</strong> and model-generated <strong>AI INTERPRETATION</strong>.
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", padding: "0.75rem 1rem", color: "#B91C1C", fontSize: "0.9rem" }}>
          {error}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1E293B" }}>
            Add Research Note or Opinion
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Target:</span>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              style={{ padding: "0.3rem 0.6rem", fontSize: "0.82rem", borderRadius: "6px", border: "1px solid var(--border)", background: "white", outline: "none" }}
            >
              <option value="investigation">General Investigation</option>
              <option value="narrative">Narrative Finding</option>
              <option value="claim">Claim Cluster</option>
              <option value="evidence">Evidence Source</option>
            </select>
          </div>
        </div>

        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder={currentUser ? "Share your analytical observations, counter-evidence, or contextual notes..." : "Sign in to add research notes and participate in this investigation."}
          disabled={!currentUser}
          rows={3}
          style={{
            width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)",
            fontSize: "0.92rem", lineHeight: "1.5", outline: "none", resize: "vertical",
            background: currentUser ? "white" : "#F1F5F9"
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {currentUser ? (
            <button
              type="submit"
              disabled={submitting || !newNote.trim()}
              style={{
                padding: "0.55rem 1.25rem", backgroundColor: "var(--accent)", color: "white",
                border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "0.88rem",
                cursor: "pointer", opacity: submitting || !newNote.trim() ? 0.6 : 1
              }}
            >
              {submitting ? "Submitting..." : "Submit User Opinion"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onAuthRequired}
              style={{
                padding: "0.55rem 1.25rem", backgroundColor: "var(--accent)", color: "white",
                border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer"
              }}
            >
              Sign In to Contribute
            </button>
          )}
        </div>
      </form>

      {/* Opinions list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)", fontSize: "0.9rem" }}>
          Loading user opinions...
        </div>
      ) : opinions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", background: "#F8FAFC", borderRadius: "10px", border: "1px dashed var(--border)", color: "var(--muted)", fontSize: "0.9rem" }}>
          No user opinions or research notes added yet. Be the first to provide analysis on this investigation.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {opinions.map((op) => (
            <div
              key={op.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "1.25rem",
                background: "white",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%", background: "#6366F1",
                    color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: "0.75rem"
                  }}>
                    {op.user_name ? op.user_name[0].toUpperCase() : "U"}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1E293B" }}>
                    {op.user_name}
                  </span>
                  <span style={{
                    background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A",
                    fontSize: "0.72rem", fontWeight: 800, padding: "0.15rem 0.5rem", borderRadius: "999px", letterSpacing: "0.04em"
                  }}>
                    USER OPINION
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#64748B", background: "#F1F5F9", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
                    {TARGET_LABELS[op.target_type] || op.target_type}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                  {op.created_at && <span>{op.created_at.slice(0, 10)}</span>}
                  {op.is_owner && (
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        onClick={() => handleStartEdit(op)}
                        style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, padding: 0 }}
                      >
                        Edit
                      </button>
                      <span>·</span>
                      <button
                        onClick={() => handleDelete(op.id)}
                        style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, padding: 0 }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {editingId === op.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--accent)", fontSize: "0.92rem", outline: "none" }}
                  />
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{ padding: "0.35rem 0.8rem", background: "#F1F5F9", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "0.82rem", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(op.id)}
                      style={{ padding: "0.35rem 0.8rem", background: "var(--accent)", color: "white", border: "none", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "0.95rem", color: "#334155", lineHeight: "1.55", whiteSpace: "pre-wrap" }}>
                  {op.note_text}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
