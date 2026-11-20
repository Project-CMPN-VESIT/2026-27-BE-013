import { useState, useEffect } from "react";
import { getAiSummary, askAi } from "../api/client";

function renderFormattedMarkdown(text) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} style={{ height: "0.5rem" }} />;
    if (trimmed.startsWith("### ")) {
      return (
        <h4 key={idx} style={{ fontSize: "1.05rem", fontWeight: 700, margin: "1rem 0 0.35rem 0", color: "#1E293B" }}>
          {trimmed.replace(/^###\s+/, "")}
        </h4>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={idx} style={{ fontSize: "1.2rem", fontWeight: 700, margin: "1.25rem 0 0.5rem 0", color: "#4F46E5", borderBottom: "1px solid #E2E8F0", paddingBottom: "0.3rem" }}>
          {trimmed.replace(/^##\s+/, "")}
        </h3>
      );
    }
    if (trimmed.startsWith("# ")) {
      return (
        <h2 key={idx} style={{ fontSize: "1.35rem", fontWeight: 800, margin: "1.25rem 0 0.5rem 0", color: "#0F172A" }}>
          {trimmed.replace(/^#\s+/, "")}
        </h2>
      );
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return (
        <li key={idx} style={{ marginLeft: "1.25rem", marginBottom: "0.35rem", lineHeight: "1.55", color: "#334155" }}>
          {trimmed.replace(/^[-*]\s+/, "")}
        </li>
      );
    }
    return (
      <p key={idx} style={{ marginBottom: "0.75rem", lineHeight: "1.6", color: "#334155", fontSize: "0.95rem" }}>
        {trimmed}
      </p>
    );
  });
}

function DeterministicFallback({ metadata, whyShift, shift, reason }) {
  const shiftEntries = shift?.shifts?.shifts || {};
  const transitions = Object.entries(shiftEntries).map(([k, v]) => ({ transition: k, value: v }));
  const drivers = whyShift?.drivers || [];
  const maxShift = transitions.length ? Math.max(...transitions.map(t => t.value)) : null;
  const DIMENSION_LABELS = {
    semantic_centroid_movement: "Semantic Shift",
    narrative_theme_composition_change: "Narrative Theme Change",
    claim_cluster_composition_change: "Claim Cluster Shift",
    source_composition_shift: "Source Composition",
    sentiment_distribution_shift: "Sentiment Distribution",
    temporal_coverage_variance: "Temporal Coverage",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ background: "#FEF9C3", border: "1px solid #FDE047", borderRadius: "8px", padding: "0.85rem 1rem", fontSize: "0.88rem", color: "#854D0E" }}>
        <strong>Notice:</strong> {reason || "AI interpretation temporarily unavailable."} Deterministic statistical findings are presented below.
      </div>
      {maxShift !== null && (
        <div style={{ padding: "0.85rem 1rem", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
          <div style={{ fontSize: "0.8rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
            Peak Observed Shift
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1E1B4B", marginTop: "0.2rem" }}>
            {maxShift.toFixed(2)}%
          </div>
          <div style={{ fontSize: "0.85rem", color: "#475569", marginTop: "0.2rem" }}>
            Empirically measured semantic vector distance across consecutive yearly reporting intervals.
          </div>
        </div>
      )}
      {drivers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: "0.8rem", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
            Key Observation Dimensions
          </div>
          {drivers.slice(0, 4).map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.4rem 0.6rem", background: "#F8FAFC", borderRadius: "6px" }}>
              <div style={{ minWidth: "40px", background: "#EEF2FF", borderRadius: "4px", padding: "0.1rem 0.25rem", fontSize: "0.73rem", fontWeight: 700, color: "#4338CA", textAlign: "center" }}>
                {d.magnitude_score?.toFixed(0)}%
              </div>
              <div style={{ fontSize: "0.88rem", color: "#374151", lineHeight: "1.4" }}>
                {DIMENSION_LABELS[d.dimension_name] || d.dimension_name}
              </div>
            </div>
          ))}
        </div>
      )}
      {(metadata?.latest_source_date || metadata?.total_usable_articles) && (
        <div style={{ fontSize: "0.78rem", color: "#94A3B8", display: "flex", gap: "1rem", flexWrap: "wrap", borderTop: "1px solid #E2E8F0", paddingTop: "0.5rem" }}>
          {metadata.total_usable_articles && <span>&bull; {metadata.total_usable_articles} articles analyzed</span>}
          {metadata.latest_source_date && <span>&bull; Latest: {metadata.latest_source_date.slice(0, 10)}</span>}
          {metadata.earliest_source_date && <span>&bull; Earliest: {metadata.earliest_source_date.slice(0, 10)}</span>}
        </div>
      )}
    </div>
  );
}

export default function AIAssistantPanel({ investigationId, type = "summary", metadata, whyShift, shift }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);

  useEffect(() => {
    if (type === "summary") {
      fetchSummary();
    } else {
      setLoading(false);
    }
  }, [investigationId, type]);

  const fetchSummary = async () => {
    try {
      const res = await getAiSummary(investigationId);
      const aiResult = res.data.ai_result || {};
      if (aiResult.ai_available === false) {
        setError(aiResult.reason || "AI interpretation temporarily unavailable.");
      } else if (aiResult.headline) {
        const parts = [
          `## ${aiResult.headline}`,
          ...(aiResult.what_changed?.length ? ["### What Changed", ...aiResult.what_changed.map(c => `- ${c}`)] : []),
          ...(aiResult.narrative_changes?.length ? ["### Narrative Evolution", ...aiResult.narrative_changes.map(c => `- ${c}`)] : []),
          ...(aiResult.source_differences?.length ? ["### Source Divergence", ...aiResult.source_differences.map(c => `- ${c}`)] : []),
          ...(aiResult.limitations?.length ? ["### Caveats & Limitations", ...aiResult.limitations.map(c => `- ${c}`)] : []),
        ];
        setContent(parts.join("\n\n"));
      } else {
        setContent("No summary available.");
      }
    } catch {
      setError("AI interpretation service unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    const q = question;
    setQuestion("");
    setChatHistory(prev => [...prev, { role: "user", content: q }]);
    try {
      const res = await askAi(investigationId, q);
      const aiResult = res.data.ai_result || {};
      if (aiResult.ai_available === false) {
        setChatHistory(prev => [...prev, { role: "assistant", content: aiResult.reason || "AI unavailable.", isError: true }]);
      } else {
        const answer = aiResult.answer || "No answer.";
        const caveats = aiResult.caveats?.length ? `\n\nCaveats: ${aiResult.caveats.join("; ")}` : "";
        setChatHistory(prev => [...prev, { role: "assistant", content: answer + caveats }]);
      }
    } catch {
      setChatHistory(prev => [...prev, { role: "assistant", content: "AI interpretation temporarily unavailable.", isError: true }]);
    }
  };

  const FreshnessBadge = () => {
    if (!metadata?.latest_source_date) return null;
    return (
      <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.75rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
        Evidence Freshness &mdash; Latest: <strong>{metadata.latest_source_date?.slice(0, 10)}</strong>
        {metadata.earliest_source_date && <> &bull; Earliest: <strong>{metadata.earliest_source_date?.slice(0, 10)}</strong></>}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ color: "var(--muted)", padding: "1.5rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
        <div style={{ width: "24px", height: "24px", border: "2px solid #E2E8F0", borderTopColor: "#4F46E5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span>Synthesizing grounded AI insights with Groq GPT-OSS 120B...</span>
      </div>
    );
  }

  if (error && type === "summary") {
    return <DeterministicFallback metadata={metadata} whyShift={whyShift} shift={shift} reason={error} />;
  }

  if (type === "summary") {
    return (
      <div>
        <FreshnessBadge />
        <div style={{ lineHeight: "1.6", fontSize: "0.95rem" }}>
          {renderFormattedMarkdown(content)}
        </div>
      </div>
    );
  }

  const SUGGESTED = [
    "What caused the biggest shift?",
    "How did sentiment change over time?",
    "What are the key narrative themes?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", background: "#FFFFFF" }}>
      <div style={{ overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem", minHeight: "260px", maxHeight: "420px" }}>
        {chatHistory.length === 0 && (
          <div style={{ color: "var(--muted)", textAlign: "center", marginTop: "1.5rem" }}>
            <div style={{ marginBottom: "0.75rem", fontSize: "0.95rem", fontWeight: 500, color: "#334155" }}>
              Ask an empirical research question grounded in this dataset:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
              {SUGGESTED.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setQuestion(q)}
                  style={{
                    background: "#F1F5F9",
                    border: "1px solid #E2E8F0",
                    borderRadius: "6px",
                    padding: "0.35rem 0.65rem",
                    fontSize: "0.78rem",
                    color: "#475569",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              background: msg.role === "user" ? "#4F46E5" : msg.isError ? "#FEF3C7" : "#F8FAFC",
              color: msg.role === "user" ? "#FFFFFF" : msg.isError ? "#92400E" : "#0F172A",
              border: msg.role === "user" ? "none" : msg.isError ? "1px solid #FDE68A" : "1px solid #E2E8F0",
              padding: "0.85rem 1.1rem",
              borderRadius: "10px",
              fontSize: "0.9rem",
              lineHeight: "1.55",
            }}
          >
            {msg.role === "assistant" ? renderFormattedMarkdown(msg.content) : msg.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleAsk} style={{ display: "flex", borderTop: "1px solid var(--border)", background: "#F8FAFC" }}>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask AI about this topic's coverage..."
          style={{ flex: 1, padding: "0.85rem 1rem", border: "none", outline: "none", fontSize: "0.9rem", background: "transparent" }}
        />
        <button
          type="submit"
          style={{
            padding: "0.85rem 1.5rem",
            background: "#4F46E5",
            color: "white",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.88rem",
            opacity: !question.trim() ? 0.6 : 1
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
