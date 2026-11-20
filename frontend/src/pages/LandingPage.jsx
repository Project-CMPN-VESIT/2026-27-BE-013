import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createInvestigation } from "../api/client";

const SUGGESTED_TOPICS = [
  { label: "Renewable Energy Transition", query: "Renewable Energy solar wind India policy", from: 2023, to: 2024 },
  { label: "Artificial Intelligence Safety", query: "Artificial Intelligence regulation governance safety", from: 2023, to: 2024 },
  { label: "Quantum Computing Breakthroughs", query: "Quantum Computing hardware algorithms commercial", from: 2021, to: 2024 },
  { label: "Global Semiconductor Policy", query: "Semiconductor supply chain chips act geopolitical", from: 2022, to: 2024 },
];

export default function LandingPage({ ctx }) {
  const { setShowLogin, user } = ctx;
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [startYr, setStartYr] = useState(2021);
  const [endYr, setEndYr] = useState(2024);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const executeInvestigation = async (topicQuery, fromYear, toYear) => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    const cleanQuery = (topicQuery || query).trim();
    if (!cleanQuery) return;

    setLoading(true);
    setError("");
    try {
      const res = await createInvestigation({
        topic: cleanQuery,
        start_year: fromYear || startYr,
        end_year: toYear || endYr,
      });
      const invId = res.data.investigation_id;
      navigate("/investigation/" + invId);
    } catch (err) {
      setError("Failed to create investigation: " + (err.response?.data?.detail || err.message));
      setLoading(false);
    }
  };

  const handleAnalyze = (e) => {
    e.preventDefault();
    executeInvestigation();
  };

  return (
    <div style={{
      maxWidth: "1140px",
      margin: "0 auto",
      padding: "3.5rem 1.5rem 4rem 1.5rem",
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Brand Hero */}
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)",
          color: "#4F46E5",
          padding: "0.4rem 1.1rem",
          borderRadius: "999px",
          fontSize: "0.85rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "1.25rem",
          border: "1px solid #E0E7FF"
        }}>
          Empirical Media Intelligence Platform
        </div>

        <h1 style={{
          fontSize: "3.75rem",
          fontWeight: 900,
          color: "#0F172A",
          lineHeight: "1.1",
          letterSpacing: "-0.03em",
          margin: "0 0 1.25rem 0"
        }}>
          Trace how news narratives <br />
          <span style={{
            background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            evolve, diverge, and shift
          </span>
        </h1>

        <p style={{
          fontSize: "1.2rem",
          color: "#475569",
          maxWidth: "680px",
          margin: "0 auto",
          lineHeight: "1.6"
        }}>
          Cross-examine multi-source journalism across time. Quantify semantic drift with vector embeddings, isolate ideological divergence, and verify empirical evidence quotes.
        </p>
      </div>

      {/* Main Search Experience */}
      <div style={{
        maxWidth: "820px",
        margin: "0 auto 3rem auto",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "20px",
        padding: "1.75rem",
        boxShadow: "0 20px 45px -10px rgba(15, 23, 42, 0.08)",
      }}>
        <form onSubmit={handleAnalyze} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748B", marginBottom: "0.5rem" }}>
              Investigation Topic or Query
            </label>
            <input
              type="text"
              placeholder="Enter any subject, crisis, policy or entity... (e.g., Renewable Energy in India)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "1.1rem 1.25rem",
                fontSize: "1.15rem",
                borderRadius: "12px",
                border: "1px solid #CBD5E1",
                outline: "none",
                background: "#F8FAFC",
                color: "#0F172A",
                boxSizing: "border-box",
                transition: "border-color 0.2s, box-shadow 0.2s"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#6366F1";
                e.target.style.boxShadow = "0 0 0 4px rgba(99, 102, 241, 0.12)";
                e.target.style.background = "#FFFFFF";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#CBD5E1";
                e.target.style.boxShadow = "none";
                e.target.style.background = "#F8FAFC";
              }}
            />
          </div>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            paddingTop: "0.5rem",
            borderTop: "1px solid #F1F5F9"
          }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>
                Analysis Period:
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.82rem", color: "#64748B" }}>From</span>
                <input
                  type="number"
                  value={startYr}
                  min={2000}
                  max={2026}
                  onChange={e => setStartYr(parseInt(e.target.value) || 2021)}
                  style={{
                    padding: "0.5rem 0.65rem",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    width: "78px",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    textAlign: "center"
                  }}
                />
                <span style={{ fontSize: "0.82rem", color: "#64748B" }}>To</span>
                <input
                  type="number"
                  value={endYr}
                  min={2000}
                  max={2026}
                  onChange={e => setEndYr(parseInt(e.target.value) || 2024)}
                  style={{
                    padding: "0.5rem 0.65rem",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    width: "78px",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    textAlign: "center"
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              style={{
                padding: "0.9rem 2.2rem",
                fontSize: "1rem",
                fontWeight: 700,
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                cursor: loading || !query.trim() ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px rgba(79, 70, 229, 0.3)",
                opacity: loading || !query.trim() ? 0.65 : 1,
                transition: "transform 0.15s, box-shadow 0.15s"
              }}
            >
              {loading ? "Starting Pipeline..." : "Start Investigation"}
            </button>
          </div>
        </form>

        {error && (
          <div style={{
            marginTop: "1.25rem",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            borderRadius: "10px",
            padding: "0.85rem 1.1rem",
            color: "#991B1B",
            fontSize: "0.9rem"
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Suggested Topic Starters */}
      <div style={{ maxWidth: "820px", margin: "0 auto 4rem auto" }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748B", marginBottom: "0.85rem", textAlign: "center" }}>
          Suggested Research Questions
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          {SUGGESTED_TOPICS.map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                setQuery(item.query);
                setStartYr(item.from);
                setEndYr(item.to);
              }}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "0.85rem 1rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#818CF8";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 14px rgba(0, 0, 0, 0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1E293B", marginBottom: "0.25rem" }}>
                {item.label}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                {item.from}&ndash;{item.to} &bull; Click to load
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Core Analytic Highlights */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "1.75rem",
        borderTop: "1px solid #E2E8F0",
        paddingTop: "3rem"
      }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "1.75rem" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
            Cosine Vector Divergence
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.5rem 0" }}>
            Semantic Shift Quantification
          </h3>
          <p style={{ fontSize: "0.92rem", color: "#475569", lineHeight: 1.55, margin: 0 }}>
            Calculates exact centroid Euclidean and cosine displacement across publication windows using 384-dimensional dense text embeddings.
          </p>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "1.75rem" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
            Comparative Taxonomy
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.5rem 0" }}>
            Source & Ideological Divergence
          </h3>
          <p style={{ fontSize: "0.92rem", color: "#475569", lineHeight: 1.55, margin: 0 }}>
            Maps Left, Centre, and Right perspectives across publisher cohorts, highlighting framing biases and sentiment variance with epistemic rigor.
          </p>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "1.75rem" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
            Grounded LLM Reasoning
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.5rem 0" }}>
            Groq GPT-OSS 120B Synthesis
          </h3>
          <p style={{ fontSize: "0.92rem", color: "#475569", lineHeight: 1.55, margin: 0 }}>
            Provides structured executive summaries and conversational interactive inquiry strictly bounded to the empirical evidence extracted.
          </p>
        </div>
      </div>
    </div>
  );
}
