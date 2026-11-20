import { useState } from "react";
import { summariseURL } from "../api/client";

function renderFormattedMarkdown(text) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} style={{ height: "0.5rem" }} />;
    if (trimmed.startsWith("### ")) {
      return (
        <h4 key={idx} style={{ fontSize: "1.1rem", fontWeight: 700, margin: "1.25rem 0 0.4rem 0", color: "#1E293B" }}>
          {trimmed.replace(/^###\s+/, "")}
        </h4>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={idx} style={{ fontSize: "1.3rem", fontWeight: 700, margin: "1.5rem 0 0.6rem 0", color: "#4F46E5", borderBottom: "1px solid #E2E8F0", paddingBottom: "0.4rem" }}>
          {trimmed.replace(/^##\s+/, "")}
        </h3>
      );
    }
    if (trimmed.startsWith("# ")) {
      return (
        <h2 key={idx} style={{ fontSize: "1.5rem", fontWeight: 800, margin: "1.5rem 0 0.75rem 0", color: "#0F172A" }}>
          {trimmed.replace(/^#\s+/, "")}
        </h2>
      );
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return (
        <li key={idx} style={{ marginLeft: "1.5rem", marginBottom: "0.4rem", lineHeight: "1.6", color: "#334155" }}>
          {trimmed.replace(/^[-*]\s+/, "")}
        </li>
      );
    }
    return (
      <p key={idx} style={{ marginBottom: "0.85rem", lineHeight: "1.65", color: "#334155", fontSize: "0.98rem" }}>
        {trimmed}
      </p>
    );
  });
}

export default function ArticleAnalyzer() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [articleTitle, setArticleTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!url.startsWith("http")) {
      setError("Please enter a valid HTTP or HTTPS article link.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setArticleTitle("");

    try {
      const res = await summariseURL(url);
      setResult(res.data.summary);
      if (res.data.title) {
        setArticleTitle(res.data.title);
      }
    } catch {
      setError("Failed to extract or analyze the specified article. Please verify the URL and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2.5rem 1.5rem", maxWidth: "920px", margin: "0 auto", minHeight: "80vh", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
          Deep Content Inspection
        </div>
        <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "#0F172A", margin: "0 0 0.5rem 0" }}>
          Article Analyzer
        </h1>
        <p style={{ fontSize: "1.05rem", color: "#64748B", margin: 0, lineHeight: 1.5 }}>
          Extract article text, evaluate narrative framing, sentiment tone, and political perspective classification using Groq GPT-OSS 120B.
        </p>
      </div>

      {/* Input Box */}
      <div style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "16px",
        padding: "1.5rem",
        marginBottom: "2rem",
        boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.05)"
      }}>
        <form onSubmit={handleAnalyze} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            type="url"
            placeholder="Paste news article URL (e.g., https://www.theguardian.com/...)"
            value={url}
            onChange={e => setUrl(e.target.value)}
            style={{
              flex: "1 1 350px",
              padding: "0.95rem 1.1rem",
              fontSize: "1rem",
              borderRadius: "10px",
              border: "1px solid #CBD5E1",
              outline: "none",
              background: "#F8FAFC"
            }}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            style={{
              padding: "0.95rem 1.75rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: loading || !url.trim() ? "not-allowed" : "pointer",
              opacity: (loading || !url.trim()) ? 0.65 : 1,
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)"
            }}
          >
            {loading ? "Analyzing Content..." : "Analyze Article"}
          </button>
        </form>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "12px", padding: "1.2rem", color: "#991B1B", marginBottom: "2rem", fontSize: "0.95rem" }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#64748B", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px" }}>
          <div style={{ width: "28px", height: "28px", border: "2px solid #E2E8F0", borderTopColor: "#4F46E5", borderRadius: "50%", margin: "0 auto 1rem auto", animation: "spin 0.8s linear infinite" }} />
          Scraping article text & performing narrative framing synthesis...
        </div>
      )}

      {result && (
        <div style={{
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "2.5rem",
          background: "#FFFFFF",
          boxShadow: "0 10px 30px -5px rgba(15, 23, 42, 0.05)"
        }}>
          {articleTitle && (
            <div style={{ borderBottom: "1px solid #E2E8F0", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                Verified Article Headline
              </div>
              <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1.35 }}>
                {articleTitle}
              </h2>
            </div>
          )}
          <div style={{ fontSize: "1rem", color: "#334155" }}>
            {renderFormattedMarkdown(result)}
          </div>
        </div>
      )}
    </div>
  );
}
